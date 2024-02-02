var keyTranslations = {
    localUrl: "Local URL",
    name: "Name",
    desc: "Description",
    version: "Version",
    manufacturer: "Manufacturer",
    id: "ID",
    wifi: "WiFi",
    ws: "Web Sockets",
    relay1: "Cooling",
    relay2: "Heating",
    ip: "IP Address",
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
      document.title = `Brewery name - ${temperature}˚C`;
  
      // Build the header content
      const headerContent = `
        <header>
            <img src="https://notthatcalifornia.github.io/IntegratedSites/img/logo.png" alt="Not That California Brewing Company" />
            <h1><span id="temperature">${temperature}<span>˚C</h1>
        </header>
      `;
  
      // Build the info content
      const infoContent = Object.entries(info).map(([key, value]) => {
        if (key == "localUrl" || key == "ip") {
            return `<p class="key"><strong>${keyTranslations[key]}:</strong></p>
            <p class="value">${value}
                <a href="http://${value}" class="btn btn-success">Go</a>
            </p>`;
        } else {
            return `<p class="key"><strong>${keyTranslations[key]}:</strong></p><p class="value" id="key-${key}">${value}</p>`;
        }
      }).join('');
  
      // Build the modules content
      const modulesContent = Object.entries(modules).map(([key, value]) => {
        return `<p><span class="indicator ${value ? 'enabled' : 'disabled'}"><i>${value ? 'Enabled' : 'Disabled'}</i></span><span class="name">${keyTranslations[key]}</span></p>`;
      }).join('');
  
      // Combine all parts into the final HTML
      const pageContent = `
        <div id="content">
            ${headerContent}
            <div class="section modules values">
                <p><span id="relay1" class="indicator ${values.relay1 ? 'enabled' : 'disabled'}"><i>${values.relay1 ? 'Enabled' : 'Disabled'}</i></span><span class="name">${keyTranslations["relay1"]}</span></p>
                <p><span id="relay2" class="indicator ${values.relay2 ? 'enabled' : 'disabled'}"><i>${values.relay2 ? 'Enabled' : 'Disabled'}</i></span><span class="name">${keyTranslations["relay2"]}</span></p>
            </div>
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

    $("#info-header").click(function(){
        $("#info").toggle("fast");
    });
    $("#info").hide();
    $("#modules-header").click(function(){
        $("#modules").toggle("fast");
    });
    $("#modules").hide();
    setLastUpdated();

    }).catch(error => {
      console.error('Error fetching data:', error);
      // Handle the error, e.g., display an error message
      document.body.innerHTML = `<p style="color:red;">Error loading data. Please try again later.</p>`;
    });
}

function handleRelay(elementId, value) {
    $(elementId).removeClass(value ? 'disabled' : 'enabled').addClass(value ? 'enabled' : 'disabled');
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
        const temperatureElement = document.getElementById('temperature');
        if (temperatureElement) {
            temperatureElement.textContent = `${data.temp1.toFixed(2)}˚C`;
        }
        const internalTemperatureElement = document.getElementById('internalTemperature');
        if (internalTemperatureElement) {
            internalTemperatureElement.textContent = `${data.int.toFixed(2)}˚C`;
        }

        handleRelay('#relay1', data.relay1);
        handleRelay('#relay2', data.relay2);

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

// Call fetchAndUpdateValues every 5 seconds
setInterval(fetchAndUpdateValues, 5000);

// Call the buildPage function once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', buildPage);
  