// script.js
// Example JavaScript for changing the navbar style on scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar.sticky-top');
    if(window.scrollY > 0) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});
