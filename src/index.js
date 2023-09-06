import dotnev from 'dotenv';
dotnev.config();
import fs from 'fs';
import { google } from 'googleapis';
import express from 'express';
import archiver from 'archiver';
import path from 'path';
import unzipper from 'unzipper';

const app = express();

const oauth2Client = new google.auth.OAuth2(
	process.env.CLIENT_ID,
	process.env.CLIENT_SECRET,
	process.env.REDIRECT_URI
);

try {
	const creds = fs.readFileSync('creds.json');
	oauth2Client.setCredentials(JSON.parse(creds));
} catch (err) {
	console.log('No creds found');
}

const PORT = process.env.PORT || 8000;

app.get('/auth/google', (req, res) => {
	const url = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: [
			'https://www.googleapis.com/auth/userinfo.profile',
			'https://www.googleapis.com/auth/drive',
		],
	});
	res.redirect(url);
});

app.get('/google/redirect', async (req, res) => {
	const { code } = req.query;
	console.log(code);
	const { tokens } = await oauth2Client.getToken(code);
	oauth2Client.setCredentials(tokens);
	fs.writeFileSync('creds.json', JSON.stringify(tokens));
	res.send('Success');
});

app.get('/saveText/:sometext', async (req, res) => {
	const drive = google.drive({ version: 'v3', auth: oauth2Client });
	const sometext = req.params.sometext;

	drive.files.create({
		requestBody: {
			name: 'test.txt',
			mimeType: 'text/plain',
		},
		media: {
			mimeType: 'text/plain',
			body: sometext,
		},
	});

	res.send('Success');
});

app.get('/listFiles', async (req, res) => {
	const drive = google.drive({ version: 'v3', auth: oauth2Client });

	try {
		// Get the folder ID for the "ApiTesting" folder
		const folderResponse = await drive.files.list({
			q: "name='ApiTesting' and mimeType='application/vnd.google-apps.folder'",
		});

		if (folderResponse.data.files.length === 0) {
			res.send('No "ApiTesting" folder found in your Google Drive.');
			return;
		}

		const folderId = folderResponse.data.files[0].id;

		// List files within the "ApiTesting" folder
		const response = await drive.files.list({
			q: `'${folderId}' in parents`,
			fields: 'files(name, mimeType)',
			pageSize: 100, // Adjust the page size as needed
		});

		const files = response.data.files;

		if (files.length === 0) {
			res.send('No files found in the "ApiTesting" folder.');
		} else {
			const fileNames = files.map((file) => ({
				name: file.name,
				mimeType: file.mimeType,
			}));
			res.json(fileNames);
		}
	} catch (error) {
		console.error('Error listing files:', error);
		res.status(500).json({
			error: 'An error occurred while listing files.',
		});
	}
});

app.get('/downloadFolder', async (req, res) => {
	const drive = google.drive({ version: 'v3', auth: oauth2Client });

	try {
		// Get the folder ID for the "ApiTesting" folder
		const folderResponse = await drive.files.list({
			q: "name='ApiTesting' and mimeType='application/vnd.google-apps.folder'",
		});

		if (folderResponse.data.files.length === 0) {
			res.status(404).send(
				'No "ApiTesting" folder found in your Google Drive.'
			);
			return;
		}

		const folderId = folderResponse.data.files[0].id;

		// List files within the "ApiTesting" folder
		const response = await drive.files.list({
			q: `'${folderId}' in parents`,
			fields: 'files(name, id)',
			pageSize: 100, // Adjust the page size as needed
		});

		const files = response.data.files;

		if (files.length === 0) {
			res.send('No files found in the "ApiTesting" folder.');
			return;
		}

		const projectDir = './'; // Save in the current directory
		const folderName = 'ApiTestingFolder';
		const folderPath = path.join(projectDir, folderName);
		const zipFilePath = path.join(projectDir, 'ApiTesting.zip');

		// Create the folder to store the folder contents
		fs.mkdirSync(folderPath, { recursive: true });

		// Create a zip archive to store the folder contents
		const archive = archiver('zip', {
			zlib: { level: 9 }, // Maximum compression
		});

		const output = fs.createWriteStream(zipFilePath);

		archive.pipe(output);

		// Add each file to the zip archive with its original name
		for (const file of files) {
			const fileId = file.id;
			const fileStream = await drive.files.get(
				{ fileId: fileId, alt: 'media' },
				{ responseType: 'stream' }
			);

			archive.append(fileStream.data, { name: file.name });
		}

		archive.finalize();

		output.on('close', () => {
			// Unzip the downloaded folder into the folder you created
			fs.createReadStream(zipFilePath)
				.pipe(unzipper.Extract({ path: folderPath }))
				.on('finish', () => {
					// Clean up the zip file
					fs.unlinkSync(zipFilePath);

					res.status(200).send(
						'Folder downloaded and unzipped successfully.'
					);
				});
		});
	} catch (error) {
		console.error('Error downloading folder:', error);
		res.status(500).json({
			error: 'An error occurred while downloading the folder.',
		});
	}
});

app.listen(PORT, () => {});
