// В основном HTML-документе
var allPlacemarks = [];
var myMap;
window.addEventListener('message', function(event) {
    if (event.origin !== "http://127.0.0.1") { // Замените на ваш домен
        return;
    }

    if (event.data.type === 'updateMap') {
        updateMapWithNewMarkers(event.data.data);
    }
});

function updateMapWithNewMarkers(data) {
    removeAllPlacemarks();
    data.forEach(point => {
        var placemark = new ymaps.Placemark([point.LAT, point.LON], {}, {
            iconLayout: 'default#image',
            iconImageHref: '../images/flot.png',
            iconImageSize: [30, 42],
            iconImageOffset: [-15, -42]
        });
        myMap.geoObjects.add(placemark);
        allPlacemarks.push(placemark);
    });
}

function removeAllPlacemarks() {
    allPlacemarks.forEach(placemark => myMap.geoObjects.remove(placemark));
    allPlacemarks = [];
}



document.addEventListener("DOMContentLoaded", function() {
    var polygonEditor; // Переменная для редактора полигонов

    ymaps.ready(init);


    function init() {
         myMap = new ymaps.Map("map", {
            center: [27.370510, -92.445696],
            zoom: 5,
            controls: ['zoomControl'],
            wrapAround: false, // запретить перемещение карты за ее границы
            suppressMapOpenBlock: true // убирает предупреждение о повторении карты
        });
        myMap.options.set('minZoom', 2);
        myMap.options.set('maxZoom', 17);



        var bounds = [
            [84, -179], // Северо-западный угол карты
            [-84, 179]  // Юго-восточный угол карты
        ];
        myMap.setBounds(bounds, {checkZoomRange: true}).then(function() {
            // Границы карты установлены
        }, function(error) {
            // Не удалось установить границы карты
            console.log(error);
        });

        // Создаем и добавляем кнопку "Тип карты" с классом опций
        var typeSelector = new ymaps.control.TypeSelector({
            options: {
                float: 'left',
                position: { top: 10, left: 10 },
                size: 'auto',
                maxWidth: 400
            }
        });

        myMap.controls.add(typeSelector);



        var customButtons = new ymaps.control.Button({
            data: {
                content: '<div style="display: flex; align-items: center;"><img src="/images/ArrowsFullscreen.png" alt="Выберите область" style="margin-right: 10px; font-family: Roboto Light;"> Выберите область</div>',
                title: 'Выбрать область'
            },
            options: {
                maxWidth: 600,
                maxHeight:600
            }
        });



        myMap.controls.add(customButtons, { float: 'none', position: { top: 10, left: 120 } }); // Измените значение left для размещения рядом


        let polygon = null; // Ссылка на текущий полигон
        let points = []; // Массив с точками
        let markers = []; // Массив с маркерами

        customButtons.events.add('click', function() {
            if (points.length) {
                // Если есть начатый процесс рисования, завершаем его
                finishDrawing();
            } else {
                // Начать процесс рисования
                startDrawing();
            }
        });
        function startDrawing() {
            myMap.events.add('click', onMapClick); // Добавляем обработчик клика по карте
        }

        function finishDrawing() {
            myMap.events.remove('click', onMapClick); // Удаляем обработчик

            if (polygon) {
                myMap.geoObjects.remove(polygon); // Удаляем старый полигон, если он был
            }

            // Удаляем маркеры
            markers.forEach(marker => {
                myMap.geoObjects.remove(marker);
            });
            markers = [];

            polygon = new ymaps.Polygon([points]); // Создаем новый полигон
            myMap.geoObjects.add(polygon); // Добавляем полигон на карту
            points = []; // Очищаем массив точек
        }


        function onMapClick(e) {
            const coords = e.get('coords'); // Получаем координаты клика
            points.push(coords); // Добавляем координаты в массив точек

            // Создаем маркер и добавляем на карту
            const marker = new ymaps.Placemark(coords, {}, {
                preset: 'islands#redDotIcon'
            });
            myMap.geoObjects.add(marker);
            markers.push(marker); // Добавляем маркер в массив
        }







        var ButtonLayout = ymaps.templateLayoutFactory.createClass([
            '<div title="{{ data.title }}" class="my-button ',
            '{% if state.size == "small" %}my-button_small{% endif %}',
            '{% if state.size == "medium" %}my-button_medium{% endif %}',
            '{% if state.size == "large" %}my-button_large{% endif %}',
            '{% if state.selected %} my-button-selected{% endif %}">',
            '<span class="my-button__text">{{ data.content }}</span>',
            '</div>',
        ].join(''));




        var thirdButton = new ymaps.control.Button({
            data: {
                image: '/images/settingOtchet.png',
                content: 'Настроить отчет'
            },
            options: {
                layout: ButtonLayout,
                maxWidth: [170, 170, 170],
                selectOnClick: false
            }
        });

        // Размещаем третью кнопку по середине по вертикали внизу экрана
        myMap.controls.add(thirdButton, { float: 'none', position: { bottom: 40, left: '50%' } });
        thirdButton.events.add('click', function() {
            if (polygon != null) {
                const coordinates = polygon.geometry.getCoordinates();
                const message = JSON.stringify(coordinates[0]);
                logToServer(message);

                // Сохраняем координаты в localStorage
                localStorage.setItem('polygonCoords', message);

                // Здесь обновляем содержимое iframe, а не переходим на другую страницу
                var iframe = document.querySelector('iframe');
                iframe.contentWindow.postMessage(message, '*');
            }
        });



        function logToServer(message) {
            fetch('/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });
        }


    }
});
