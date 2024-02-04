document.addEventListener("DOMContentLoaded", function() {
    var navbar = document.getElementById('mainNav'); // Get the navbar
    var navbarCollapse = function() {
        if (window.scrollY > 50) { // Adjust the threshold value (50) as needed
            navbar.classList.add('navbar-shrink');
        } else {
            navbar.classList.remove('navbar-shrink');
        }
    };

    // Debounce function to limit the rate at which a function can fire
    var debounce = function(func, wait = 10, immediate = true) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    // Set up the event listener with the debounce function
    window.addEventListener('scroll', debounce(navbarCollapse));
});