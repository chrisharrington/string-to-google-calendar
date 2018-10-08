const express = require('express'),
    chrono = require('chrono-node'),
    bodyParser = require('body-parser'),
    fs = require('fs');
    readline = require('readline'),
    {google} = require('googleapis'),
    moment = require('moment');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'token.json';

const app = express();

app.use(bodyParser.json());

app.post('/', (request, response) => {
    const parsed = chrono.parse(request.body.value, new Date(), { forwardDate: true });
    if (!parsed || parsed.length === 0)
        response.status(400).send('Unknown date time format.');
    else {
        const date = parsed[0].start.date(),
            summary = request.body.value.substring(0, parsed[0].index);
        const event = {
            summary: summary[0].toUpperCase() + summary.substring(1),
            start: {
                dateTime: moment(date).toISOString()
            },
            end: {
                dateTime: moment(date).add(1, 'hour').toISOString()
            } 
        };

        fs.readFile('credentials.json', (err, content) => {
            if (err)
                return console.log('Error loading client secret file:', err);

            authorize(JSON.parse(content), auth => createEvent(auth, event, err => {
                if (err)
                    response.status(500).send('An unexpected error has occurred.');
                else {
                    console.log(`Event created: ${request.body.value}`);
                    response.status(200).send(parsed[0].start.date().toString());
                }
            }));
        });
    }
});

app.listen(1234, () => {
    console.log('Listening on port 1234...');
});

function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);

      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function createEvent(auth, event, callback) {
    const id = '62gtt19l65nm29jnn1djkrvto0@group.calendar.google.com';

    const calendar = google.calendar({version: 'v3', auth});
    calendar.events.insert({
        auth: auth,
        calendarId: id,
        resource: event,
      }, function(err) {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            callback(err);
        } else
            callback();
      });
}