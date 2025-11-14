import express from "express";
import { google } from "googleapis";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = "TU_CLIENT_ID.apps.googleusercontent.com";
const CLIENT_SECRET = "TU_CLIENT_SECRET";
const REDIRECT_URI = "http://localhost:3000/oauth2callback"; // puede ser otro dominio
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Endpoint para generar URL de autorización
app.get("/auth/url", (req, res) => {
  const scopes = ["https://www.googleapis.com/auth/calendar"];
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });
  res.json({ url });
});

// Endpoint para recibir el código de Google y devolver token
app.post("/auth/token", async (req, res) => {
  const { code } = req.body;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    res.json(tokens);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Endpoint ejemplo: listar eventos
app.get("/calendar/events", async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
    const events = await calendar.events.list({
      calendarId: "primary",
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });
    res.json(events.data.items);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Backend corriendo en http://localhost:3000"));
