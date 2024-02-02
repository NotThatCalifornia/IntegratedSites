// Function to fetch data from the ESP32 endpoints and build the page content
function buildPage() {
    // Fetch all required data
    Promise.all([
      fetch('/values').then(response => response.json()),
      fetch('/info').then(response => response.json()),
      fetch('/modules').then(response => response.json())
    ]).then(([values, info, modules]) => {
      // Extract temperature and update the title
      const temperature = values.temp1;
      const internalTemperature = values.int;
      document.title = `Brewery name - ${temperature}˚C`;
  
      // Build the header content
      const headerContent = `
        <header>
            <img src="http://localhost/img/logo.png" alt="Not That California Brewing Company" />
            <h1>${temperature}˚C</h1>
        </header>
      `;
  
      // Build the info content
      const infoContent = Object.entries(info).map(([key, value]) => {
        return `<p class="key"><strong>${key}:</strong></p><p class="value">${value}</p>`;
      }).join('');
  
      // Build the modules content
      const modulesContent = Object.entries(modules).map(([key, value]) => {
        return `<p><span class="indicator ${value ? 'enabled' : 'disabled'}"><i>${value ? 'Enabled' : 'Disabled'}</i></span><span class="name">${key}</span></p>`;
      }).join('');
  
      // Combine all parts into the final HTML
      const pageContent = `
        <div id="content">
            ${headerContent}
            <div id="info">
                <h4>System info</h4>
                <p class="key"><strong>Device temperature:</strong></p><p class="value">${internalTemperature}</p>
                ${infoContent}
            </div>
            <div id="modules">
                <h4>Available modules</h4>
                ${modulesContent}
            </div>
        </div>
      `;
  
      // Inject the new content into the body, replacing all current elements
      document.body.innerHTML = pageContent;
    }).catch(error => {
      console.error('Error fetching data:', error);
      // Handle the error, e.g., display an error message
      document.body.innerHTML = `<p style="color:red;">Error loading data. Please try again later.</p>`;
    });
  }
  
  // Call the buildPage function once the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', buildPage);
  