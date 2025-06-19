# Node.js Project Template

Modern bir Node.js projesi şablonu. Bu template, yeni projeler başlatmak için hazır bir yapı sunar.

## 🚀 Özellikler

- Express.js web framework
- Environment variables desteği (.env)
- CORS desteği
- Güvenlik middleware'leri (Helmet)
- Logging (Morgan)
- Hot reload (Nodemon)
- Testing (Jest)
- Code linting (ESLint)
- Code formatting (Prettier)

## 📋 Gereksinimler

- Node.js 18.0.0 veya üzeri
- npm veya yarn

## 🛠️ Kurulum

1. Projeyi klonlayın:
```bash
git clone <repository-url>
cd nodejs-project-template
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Environment dosyasını oluşturun:
```bash
cp .env.example .env
```

4. Gerekli environment değişkenlerini düzenleyin:
```bash
# .env dosyasını düzenleyin
PORT=3000
NODE_ENV=development
```

## 🏃‍♂️ Çalıştırma

### Development modu
```bash
npm run dev
```

### Production modu
```bash
npm start
```

### Test çalıştırma
```bash
npm test
```

### Code linting
```bash
npm run lint
npm run lint:fix
```

### Code formatting
```bash
npm run format
```

## 📁 Proje Yapısı

```
├── src/
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── routes/          # Route definitions
│   ├── utils/           # Utility functions
│   └── index.js         # Main application file
├── tests/               # Test files
├── .env.example         # Environment variables template
├── .eslintrc.js         # ESLint configuration
├── .prettierrc          # Prettier configuration
├── jest.config.js       # Jest configuration
├── package.json         # Project dependencies
└── README.md           # Project documentation
```

## 🔧 Konfigürasyon

### Environment Variables

`.env` dosyasında aşağıdaki değişkenleri tanımlayabilirsiniz:

```env
PORT=3000
NODE_ENV=development
```

### ESLint

Proje ESLint ile kod kalitesini kontrol eder. Konfigürasyon `.eslintrc.js` dosyasında bulunur.

### Prettier

Kod formatlaması için Prettier kullanılır. Konfigürasyon `.prettierrc` dosyasında bulunur.

## 🧪 Testing

Jest test framework'ü kullanılır. Test dosyaları `tests/` klasöründe bulunur.

```bash
# Tüm testleri çalıştır
npm test

# Testleri watch modunda çalıştır
npm run test:watch
```

## 📝 Scripts

- `npm start`: Production modunda uygulamayı başlatır
- `npm run dev`: Development modunda uygulamayı başlatır (hot reload ile)
- `npm test`: Testleri çalıştırır
- `npm run test:watch`: Testleri watch modunda çalıştırır
- `npm run lint`: ESLint ile kod kontrolü yapar
- `npm run lint:fix`: ESLint ile kod düzeltmelerini uygular
- `npm run format`: Prettier ile kod formatlaması yapar

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 İletişim

Proje Sahibi - [@yourusername](https://github.com/yourusername)

Proje Linki: [https://github.com/yourusername/nodejs-project-template](https://github.com/yourusername/nodejs-project-template) # mailwise-server
