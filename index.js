const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

const REPO_URL = process.env.REPO_URL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const REPO_DIR_NAME = 'my-local-repo';

if (!REPO_URL || !ACCESS_TOKEN) {
  console.error('HATA: REPO_URL ve ACCESS_TOKEN ortam değişkenleri ayarlanmamış!');
  process.exit(1);
}

const remoteUrlWithToken = REPO_URL.replace('https://', `https://${ACCESS_TOKEN}@`);

const repoPath = path.join(__dirname, REPO_DIR_NAME);

try {
  if (fs.existsSync(repoPath)) {
    console.log('Eski repo klasörü temizleniyor...');
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
  console.log(`Repo klonlanıyor: ${REPO_URL}`);
  execSync(`git clone ${remoteUrlWithToken} ${repoPath}`);
  console.log('Repo başarıyla klonlandı.');
  
  execSync(`git config --global user.email "bot@render.com"`);
  execSync(`git config --global user.name "Render Deploy Bot"`);

} catch (error) {
  console.error('Repo klonlanırken kritik bir hata oluştu:', error.toString());
  process.exit(1);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, repoPath);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('myFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Lütfen yüklenecek bir dosya seçin.');
  }

  const fileName = req.file.filename;

  try {
    console.log(`Dosya "${fileName}" yüklendi. Değişiklikler Codeberg'e gönderiliyor...`);

    execSync(`git -C ${repoPath} add .`);
    execSync(`git -C ${repoPath} commit -m "Render Bot: Yeni dosya eklendi - ${fileName}"`);
    execSync(`git -C ${repoPath} push`);

    console.log('Değişiklikler başarıyla Codeberg\'e gönderildi.');
    res.status(200).send(`
        <h1>Başarılı!</h1>
        <p><b>${fileName}</b> isimli dosyanız başarıyla Codeberg reponuza yüklendi.</p>
        <a href="/">Yeni dosya yükle</a>
    `);

  } catch (error) {
    console.error('Git işlemi sırasında hata oluştu:', error.toString());
    res.status(500).send('Dosya Codeberg\'e gönderilirken bir sunucu hatası oluştu. Lütfen logları kontrol edin.');
  }
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışmaya başladı.`);
});
