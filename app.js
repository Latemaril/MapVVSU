var express = require('express');
const mysql = require('mysql2/promise');
const turf = require('@turf/turf');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const fs = require('fs');
const fastcsv = require('fast-csv');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 5987;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test'
};



////////////////////////////////////////////Otchet///////////////////////////////////////////////////////////////////
const pool = mysql.createPool(dbConfig);
app.post('/Otchet', async (req, res) => {
    const {date, startTime, endTime, email, coords} = req.body;
    const [startDay, startMonth, startYear] = date.split(' to ')[0].split('.').map(d => parseInt(d, 10));
    const [endDay, endMonth, endYear] = date.split(' to ')[1].split('.').map(d => parseInt(d, 10));

    const formattedStartDate = `20${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}T${startTime}:00`;
    const formattedEndDate = `20${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}T${endTime}:00`;

    const parsedCoords = JSON.parse(coords);

    console.log("Starting process for date range:", formattedStartDate, "to", formattedEndDate);

    const CHUNK_SIZE = 3000;
    let offset = 0;
    // Проверка на существование папки reports

    const reportsDirectory = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDirectory)) {
        fs.mkdirSync(reportsDirectory);
    }
    // Создаем Excel файл
    const fileName = path.join(reportsDirectory, `report_${Date.now()}.csv`);
    const csvStream = fastcsv.format({ headers: true });
    const writableStream = fs.createWriteStream(fileName);
    csvStream.pipe(writableStream);

    const polygon = turf.polygon([parsedCoords]);

    while (true) {
        console.log(`Fetching data chunk starting from offset ${offset}...`);

        const { rows } = await pool.query(
           'SELECT * FROM Flot WHERE "BaseDateTime" BETWEEN $1 AND $2 LIMIT $3 OFFSET $4',
           [formattedStartDate, formattedEndDate, CHUNK_SIZE, offset]
        );

        if (rows.length === 0) {
            console.log("No more data to process. Exiting loop.");
            break; // Если больше нет строк для обработки, завершаем цикл
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const point = turf.point([parseFloat(row.LAT), parseFloat(row.LON)]);
            if (turf.booleanPointInPolygon(point, polygon)) {
                csvStream.write(row);
            }
        }

        offset += CHUNK_SIZE; // Переходим к следующей порции данных
    }
    csvStream.end();
    console.log(`CSV file saved as ${fileName} on server.`);

    console.log("Finalizing Excel file...");
    console.log("Excel file created successfully.");
    const yandexUser = 'KostyaOtlichnik12@yandex.ru'; // Ваш доменный адрес на Яндексе
    const yandexPass = 'fmmjhrqmldnjxoec'; // Ваш пароль от почты
    // Отправляем email с созданным файлом
    console.log("Sending email with the report...");
    const transporter = nodemailer.createTransport({
        host: 'smtp.yandex.ru',
        port: 465,
        secure: true, // используйте SSL
        auth: {
            user: yandexUser,
            pass: yandexPass
        }
    });

    const fileSize = fs.statSync(fileName).size / (1024 * 1024); // размер в МБ

    const mailOptions = {
        from: yandexUser,
        to: email,
        subject: 'Отчет',
        text: 'Прилагаемый файл содержит запрашиваемые данные.',
    };

    if (fileSize > 100) {
        const fileURL = saveFileToServerAndGetURL(fileName);
        mailOptions.text = `Данные слишком велики для отправки как вложение. Вы можете скачать файл по следующей ссылке: ${fileURL}`;
    } else {
        mailOptions.attachments = [
            {
                filename: 'report.csv',
                path: fileName
            }
        ];
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            res.status(500).send('Error sending email.');
        } else {
            console.log('Report sent successfully to', email);
            res.send('Report sent successfully.');
        }
    });

// ...

    function saveFileToServerAndGetURL(fileName) {
        const fileBaseName = path.basename(fileName); // получаем имя файла без пути
        return `/reports/${fileBaseName}`;
    }
});


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////Получение данных карт

const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LON = -180;
const MAX_LON = 180;

function formatDate(date) {
    const [year, month, day] = date.split('-').map(d => parseInt(d, 10));
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
}


app.get('/get-coordinates', async (req, res) => {
    try {
        const fromDate = req.query.fromDate ? formatDate(req.query.fromDate) : null;
        const toDate = req.query.toDate ? formatDate(req.query.toDate) : null;
        console.log("Отформатированные даты", fromDate, toDate);
        const coordinates = await getCoordinates(fromDate, toDate);
        res.json(coordinates);
    } catch (error) {
        res.status(500).send('Ошибка сервера при получении координат: ' + error.message);
    }
});







async function getCoordinates(fromDate, toDate) {
    try {
        let query = 'SELECT "LAT", "LON" FROM Flot';
        const params = [];

        if (fromDate && toDate) {
            query += ' WHERE "BaseDateTime" BETWEEN $1 AND $2';
            params.push(fromDate, toDate);
        }

        const { rows } = await pool.query(query, params);
        const processedResults = processCoordinates(rows);
        return processedResults;
    } catch (error) {
        throw error;
    }
}



// Функция для обработки координат (это примерная логика, вам нужно будет разработать свою)
function processCoordinates(coordinates) {
    const latStep = (MAX_LAT - MIN_LAT) / Math.sqrt(50);
    const lonStep = (MAX_LON - MIN_LON) / Math.sqrt(50);
    let processedCoordinates = [];

    coordinates.forEach(coordinate => {
        const lat = parseFloat(coordinate.LAT);
        const lon = parseFloat(coordinate.LON);

        // Определяем индекс квадрата для широты
        const latIndex = Math.floor((lat - MIN_LAT) / latStep);
        // Определяем индекс квадрата для долготы
        const lonIndex = Math.floor((lon - MIN_LON) / lonStep);

        // Используем пару индексов как ключ для определения уникальности квадрата
        const squareKey = `${latIndex}-${lonIndex}`;

        // Если квадрат уже в списке, не добавляем его
        if (!processedCoordinates.some(item => item.key === squareKey)) {
            processedCoordinates.push({
                key: squareKey,
                LAT: MIN_LAT + latIndex * latStep + latStep / 2, // Центральная широта квадрата
                LON: MIN_LON + lonIndex * lonStep + lonStep / 2, // Центральная долгота квадрата
            });
        }
    });

    return processedCoordinates;
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/log', (req, res) => {
    console.log(req.body.message);
    res.send('Logged to server console');
});