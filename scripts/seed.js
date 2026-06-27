const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seed() {
  const textsPath = path.join(__dirname, '..', 'texts.json');
  const textsData = JSON.parse(fs.readFileSync(textsPath, 'utf8'));

  for (const text of textsData) {
    const docRef = db.collection('texts_for_reading').doc(text.id);
    await docRef.set(text);
    console.log(`Uploaded ${text.id} - ${text.title}`);
  }
  console.log('Seed complete!');
}

seed().catch(console.error);
