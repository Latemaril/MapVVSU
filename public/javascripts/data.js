flatpickr("#datePicker", {
    mode: "range",
    dateFormat: "d.m.y",
    locale: "ru",
    onChange: function(selectedDates) {
        if (selectedDates.length === 2) {
            // Форматирование дат для отправки на сервер
            var fromDate = selectedDates[0].toISOString().slice(0, 10); // формат YYYY-MM-DD
            var toDate = selectedDates[1].toISOString().slice(0, 10); // формат YYYY-MM-DD

            // Отправка запроса на сервер
            fetch(`/get-coordinates?fromDate=${fromDate}&toDate=${toDate}`)
                .then(response => response.json())
                // Внутри <iframe>
                .then(data => {
                    console.log("Полученные данные с сервера:", data);
                    window.parent.postMessage({ type: 'updateMap', data: data }, '*');
                })

                .catch(error => console.error('Error:', error));
        }
    }
});



var savedCoords = null;

// Обработчик события message для получения координат
window.addEventListener('message', function(event) {
    console.log("Сообщение получено", event);

    if (event.origin !== "https://mr-tr.ru") {
        console.log("Сообщение от неподходящего источника: ", event.origin);
        return;
    }

    try {
        savedCoords = localStorage.getItem('polygonCoords');
        // Теперь data содержит координаты
    } catch (e) {
        console.error("Ошибка при разборе JSON: ", e);
    }
});


$(document).ready(function() {
    var startTime = 0;  // начало рабочего дня (00:00)
    var endTime = 24;    // конец рабочего дня (24:00)
    var increment = 15;  // интервал в минутах

    function createTimeDropdown(prefix) {
        // Создание временных интервалов
        for (var i = startTime; i < endTime; i++) {
            for (var j = 0; j < 60; j += increment) {
                var time = (i < 10 ? "0" + i : i) + ":" + (j < 10 ? "0" + j : j);
                $("#" + prefix + "timeDropdown").append('<div>' + time + '</div>');
            }
        }

        // Показать/скрыть выпадающий список
        $("#" + prefix + "timeInput").click(function() {
            $("#" + prefix + "timeDropdown").toggle();
        });

        // Выбор времени
        $("#" + prefix + "timeDropdown div").click(function() {
            $("#" + prefix + "timeInput").val($(this).text());
            $("#" + prefix + "timeDropdown").hide();
        });
    }

    createTimeDropdown("");       // начало времени
    createTimeDropdown("end");    // окончание времени

    // Скрыть списки, если клик за пределами элементов
    $(document).click(function(e) {
        if (!$(e.target).is(".time-input, .time-dropdown, .time-dropdown div")) {
            $(".time-dropdown").hide();
        }
    });
});

//////////////////////////отправка запроса///////////////////////////////////////////////////////////////////////////////
$(document).ready(function() {

    $(".imageOtchet").click(function() {
        var allValid = true; // Флаг для проверки всех инпутов

        if ($("#datePicker").val() === "") {
            showError($("#datePicker"), "Дата выбрана не верно. Проверьте правильность введенных данных. Если данные введены правильно, значит вы выбрали дату, которая уже занята.");
            allValid = false;
        } else {
            showSuccess($("#datePicker"));
        }

        if ($("#timeInput").val() === "") {
            showError($("#timeInput"), "Введенное вами время уже занято.");
            allValid = false;
        } else {
            showSuccess($("#timeInput"));
        }

        if ($("#endtimeInput").val() === "") {
            showError($("#endtimeInput"), "Введенное вами время уже занято.");
            allValid = false;
        } else {
            showSuccess($("#endtimeInput"));
        }

        if (!validateEmail($("#email").val())) {
            showError($("#email"), "Адрес электронной почты введен некорректно.");
            allValid = false;
        } else {
            showSuccess($("#email"));
        }



        if (allValid) {
            console.log(`${savedCoords}`)
            // Отправляем POST-запрос на сервер
            $.post("/Otchet", {
                date: $("#datePicker").val(),
                startTime: $("#timeInput").val(),
                endTime: $("#endtimeInput").val(),
                email: $("#email").val(),
                coords: savedCoords  // передаем сохраненные координаты в POST-запросе
            }, function(data) {
                // Обработка ответа от сервера, если необходимо
            });
            alert("Происходит подготовка отправки");


        }
    });

    function validateEmail(email) {
        var regex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g;
        return regex.test(email);
    }

    function showError(inputElement, message) {
        inputElement.addClass('error-border').removeClass('success-border'); // Добавляем класс для красного цвета рамки
        if (inputElement.next(".error-message").length === 0) {
            inputElement.after("<div class='error-message' style='color: red; margin-left: 10%;'>" + message + "</div>");
        }
    }

    function showSuccess(inputElement) {
        inputElement.removeClass('error-border').addClass('success-border'); // Добавляем класс для зеленого цвета рамки
        inputElement.next(".error-message").remove();
    }

    // Обработчик события change для всех инпутов
    $("input").change(function() {
        var inputElement = $(this);
        if (inputElement.val() !== "") {
            showSuccess(inputElement);
        } else {
            inputElement.removeClass('success-border').removeClass('error-border');
        }
    });

});

