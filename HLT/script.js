var keyTranslations = {
    localUrl: "Local URL",
    name: "Name",
    desc: "Description",
    version: "Version",
    manufacturer: "Manufacturer",
    id: "ID",
    wifi: "WiFi",
    ws: "Web Sockets",
    relay1: "Heating",
    relay2: "Cooling",
    ip: "IP Address",
    min: "Min temperature",
    max: "Max temperature",
    content: "Content",
};

function buildPage() {
    // Fetch all required data
    Promise.all([
      fetch('/values').then(response => response.json()),
      fetch('/info').then(response => response.json()),
      fetch('/modules').then(response => response.json())
    ]).then(([values, info, modules]) => {
        // Extract temperature and update the title
        const temperature = values.temp1.toFixed(2);
        const internalTemperature = values.int.toFixed(2);
        const targetTemperature = values.targetTemp.toFixed(2);
        document.title = `Brewery HLT - ${temperature}˚C`;
    
        var deviceName = "n/a";
        var deviceType = "n/a";
        // Build the info content
        const infoContent = Object.entries(info).map(([key, value]) => {
            if (key == "name") {
                deviceName = value;
            }
            if (key == "desc") {
                deviceType = value;
            }
            if (key == "localUrl" || key == "ip") {
                return `<p class="key"><strong>${keyTranslations[key]}:</strong></p>
                <p class="value">${value}
                    <a href="http://${value}" class="btn btn-success">Go</a>
                </p>`;
            } else {
                return `<p class="key"><strong>${keyTranslations[key]}:</strong></p><p class="value" id="key-${key}">${value}</p>`;
            }
    }).join('');
      
    // Build the header content
    const headerContent = `
    <header>
        <img src="https://notthatcalifornia.github.io/IntegratedSites/img/logo.png" alt="Not That California Brewing Company" />
        <h1><b>${deviceName.toUpperCase()} - ${deviceType}</b><br><span id="temperature">${temperature}<span>˚C</h1>
        <p class="tankContent">${values.content}</p>
        <h3>(Target temperature: <span id="targetTemperature">${targetTemperature}˚C</span>)</h3>
    </header>
    `;

    // Build the modules content
    const modulesContent = Object.entries(modules).map(([key, value]) => {
        return `<p><span class="indicator ${value ? 'enabled' : 'disabled'}"><i>${value ? 'Enabled' : 'Disabled'}</i></span><span class="name">${keyTranslations[key]}</span></p>`;
    }).join('');
  
    // Combine all parts into the final HTML
    var statusStyle = values.relay1 ? 'warning' : 'success';
    var statusText = values.relay1 ? 'Heating' : 'Idle';
    if (!values.enabled) {
        statusText = "Off";
        statusStyle = "secondary";
    }
    

    const pageContent = `
        <div id="content">
            ${headerContent}
            <div class="section modules values">
                <!--<p><span id="relay1" class="indicator ${values.relay1 ? 'enabled' : 'disabled'}"><i>${values.relay1 ? 'Enabled' : 'Disabled'}</i></span><span class="name">${keyTranslations["relay1"]}</span></p>-->
                <div class="row justify-content-center align-items-center">
                    <div class="col-auto">
                        <div id="statusBox" class="form-check form-switch fs-2">
                            <input class="form-check-input" type="checkbox"${values.enabled ? ' checked' : ''}>
                            <label class="badge bg-${statusStyle}">${statusText}</label>
                        </div>
                    </div>
                </div>
                <br><br>
            </div>
            <!-- TARGET SECTION -->
            <div class="section info">
                <div class="text-center">
                    <h4 id="set-header" class="btn btn-success dropdown-toggle">
                        Set target temperature
                        <span class="caret"></span>
                    </h4>
                </div>
                <form target="#" id="set" class="card">
                    <div class="mb-3">
                        <div id="target-feedback" class="alert">:(</div>
                        <div class="input-group">
                            <input type="text" id="target" name="target" class="form-control" placeholder="Target temperature" aria-label="Target temperature" aria-describedby="target-feedback" />
                            <span class="input-group-text">˚C</span>
                            <button class="btn btn-primary" type="submit">Submit</button>
                        </div>
                        <div class="text-center small-info">Values between ${info.min}˚C and ${info.max}˚C</div>
                    </div>
                </form>
            </div>
            <!-- END TARGET SECTION -->
            <!-- NAME SECTION -->
            <div class="section info">
                <div class="text-center">
                    <h4 id="name-header" class="btn btn-success dropdown-toggle">
                        Device name
                        <span class="caret"></span>
                    </h4>
                </div>
                <form target="#" id="name" class="card">
                    <div class="mb-3">
                        <div id="name-feedback" class="alert">:)</div>
                        <div class="input-group">
                            <input type="text" id="name" name="name", value="${deviceName}" class="form-control" placeholder="Device name" aria-label="Device name" aria-describedby="name-feedback" />
                            <button class="btn btn-primary" type="submit">Submit</button>
                        </div>
                        <div class="text-center small-info">Device will reboot after saving</div>
                    </div>
                </form>
            </div>
            <!-- END NAME SECTION -->
            <div class="section info">
                <div class="text-center">
                    <h4 id="info-header" class="btn btn-warning dropdown-toggle">
                        System info
                        <span class="caret"></span>
                    </h4>
                </div>
                <div id="info" class="card">
                    <p class="key"><strong>Device temperature:</strong></p><p class="value" id="internalTemperature">${internalTemperature}˚C</p>
                    ${infoContent}
                </div
            </div>
            <div class="section modules">
                <div class="text-center">
                    <h4 id="modules-header" class="btn btn-warning dropdown-toggle">
                        Available modules
                        <span class="caret"></span>
                    </h4>
                </div>
                <div id="modules" class="card">
                    ${modulesContent}
                </div>
            </div>
            <div class="footer section text-center">
                <p>Last update: <span id="lastUpdate"></span></p>
                <p>
                    &copy; 
                    <a href="https://notthatcalifornia.com">
                        Not That California Brewing Co.
                    </a>
                    &
                    Krafaj R&D Ltd
                </p>
            </div>
        </div>
      `;
      // Inject the new content into the body, replacing all current elements
      document.body.innerHTML = pageContent;

    $("#set-header").click(function(){
        $("#set").toggle("fast");
    });
    $("#set").hide();
    $("#name-header").click(function(){
        $("#name").toggle("fast");
    });
    $("#name").hide();
    $("#info-header").click(function(){
        $("#info").toggle("fast");
    });
    $("#info").hide();
    $("#modules-header").click(function(){
        $("#modules").toggle("fast");
    });
    $("#modules").hide();
    setLastUpdated();

    $('form#set').on('submit', function(event) {
        event.preventDefault();
        submitData("target");
    });
    $('form#name').on('submit', function(event) {
        event.preventDefault();
        submitData("name");
    });

    $("#target-feedback").hide();
    $("#name-feedback").hide();



    $('#statusBox input').change(function() {
        if ($(this).is(':checked')) {
            // The switch is checked, call the /enable endpoint
            $.ajax({
                url: '/enable',
                type: 'POST', // Assuming the endpoint expects a POST request
                success: function(response) {
                    // Handle success
                    console.log('Enabled', response);
                },
                error: function(xhr, status, error) {
                    // Handle error
                    console.error('Error enabling', error);
                }
            });
        } else {
            // The switch is not checked, call the /disable endpoint
            $.ajax({
                url: '/disable',
                type: 'POST', // Assuming the endpoint expects a POST request
                success: function(response) {
                    // Handle success
                    console.log('Disabled', response);
                },
                error: function(xhr, status, error) {
                    // Handle error
                    console.error('Error disabling', error);
                }
            });
        }
    });



    }).catch(error => {
      console.error('Error fetching data:', error);
      document.body.innerHTML = `<p style="color:red;">Error loading data. Please try again later.</p>`;
    });
}

function fetchAndUpdateValues() {
    fetch('/values')
        .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
        })
        .then(data => {
            $('#temperature').text(`${data.temp1.toFixed(2)}˚C`);
            $('#internalTemperature').text(`${data.int.toFixed(2)}˚C`);
            $('#targetTemperature').text(`${data.targetTemp.toFixed(2)}˚C`);
            $('header .tankContent').text(data.content);
            $('#statusBox label').text(data.status);
            if (data.status == "Error") {
                $('#statusBox label').removeClass().addClass("badge bg-danger");
            } else if (data.status == "Off" || data.status == "Empty") {
                $('#statusBox label').removeClass().addClass("badge bg-secondary");
            } else {
                if (data.relay1 == true) {
                    $('#statusBox label').removeClass().addClass("badge bg-warning");
                } else {
                    $('#statusBox label').removeClass().addClass("badge bg-success");
                }
            }
            //$('#statusBox label').removeClass().addClass(newClass);
            $('#statusBox input').attr('checked', data.enabled);



            document.title = `Brewery name - ${data.temperature}˚C`;
            setLastUpdated();
        })
        .catch(error => {
        console.error('Error fetching /values:', error);
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
            errorDiv.textContent = 'Error loading data. Please try again later.';
        }
    });
}

function getDefaultFormattedDateTime() {
    const now = new Date(Date.now());
    const formattedDateTime = now.toLocaleString();
    return formattedDateTime;
}

function setLastUpdated() {
    const internalTemperatureElement = document.getElementById('lastUpdate');
    if (internalTemperatureElement) {
        internalTemperatureElement.textContent = getDefaultFormattedDateTime();
    }
}

function submitData(inputName) {
    const value = $('input[name="' + inputName + '"]').val();
    const apiEndpoint = '/';
    $.ajax({
        url: apiEndpoint,
        type: 'POST',
        data: {
            [inputName]: value
        },
        success: function(data) {
            $('input[name="' + inputName + '"]').val("");
            fetchAndUpdateValues();

            console.log('Form submitted:', data);
            const inputField = $('#' + inputName);
            const feedbackContainer = $('#' + inputName + 'feedback');
            if (data.success) {
                feedbackContainer.removeClass('alert-danger').addClass('alert-success').text('Success: The new target temperature is ' + data.target + '˚C');
                inputField.removeClass('is-invalid').addClass('is-valid');
                setTimeout(function() {
                    inputField.removeClass('is-valid');
                    setTimeout(function() {
                        $("#set").toggle("fast");
                    }, 1000);
                }, 4000);
            } else {
                feedbackContainer.removeClass('alert-success').addClass('alert-danger').text('An error occurred. Please try again.');
                inputField.removeClass('is-valid').addClass('is-invalid')
                setTimeout(function() {
                    inputField.removeClass('is-invalid');
                }, 5000);
            }
            feedbackContainer.show("fast").delay(3000).hide("fast");
        },
        error: function(jqXHR, textStatus, errorThrown) {
            let message = 'An error occurred while submitting the form. Please try again.';
            if (jqXHR.responseText) {
                try {
                    const response = JSON.parse(jqXHR.responseText);
                    message = response.message;
                    
                } catch (e) {
                    alert(e);
                }
            }
            console.error('Error submitting form:', textStatus, errorThrown);
            const inputField = $('#' + inputName);
            const feedbackContainer = $('#' + inputName + 'feedback');
            feedbackContainer.removeClass('alert-success').addClass('alert-danger').text(message);
            inputField.removeClass('is-valid').addClass('is-invalid');
            feedbackContainer.show("fast").delay(3000).hide("fast");
            setTimeout(function() {
                inputField.removeClass('is-invalid');
            }, 5000);
        }
    });
}

// Call fetchAndUpdateValues every 5 seconds
setInterval(fetchAndUpdateValues, 5000);

// Call the buildPage function once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', buildPage);
  