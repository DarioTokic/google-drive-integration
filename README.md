# GoogleApi setup for Drive

Google Cloud Console

-   Create a Project
-   APIs & services
-   Create OAuth consent screen
-   Credentials -> Create Credentials -> OAuth client ID

Aplication type - Web application

-   Add Authorized JavaScript origins (http://localhost:8000)
-   Add Authorized redirect URIs (http://localhost:8000/google/redirect)

Place CLIENT_ID, CLIENT_SECRET and REDIRECT_URI in .env

-   Enabled APIs & services -> ENABLE APIS AND SERVICES -> Google Drive API -> ENABLE

That should be it on Google Cloud Console.

IN THE PROJECT

install googleapis dependency and archiver, unzipper and path if not installed

SETTING UP CLIENT ON STARTUP

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

MAKING THE CREDS.JSON FILE

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

-   go to both endpoints

GETTING THE DRIVE IN A CONSTANT

const drive = google.drive({ version: 'v3', auth: oauth2Client });

drive.files.list()
const files = response.data.files;

drive.files.create()
