let lastClickedBtn = null;
let originalBtnText = "";
const spinnerHtml = '<div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>';

function ToggleUI(isDisabled) 
{
    const inputs = document.querySelectorAll('button, input, textarea, select');
    inputs.forEach(el => el.disabled = isDisabled);

    const links = document.querySelectorAll('a');
    links.forEach(link => link.style.pointerEvents = isDisabled ? "none" : "auto");
}

function LockUI(user_click_on_button = null)
{
    if (user_click_on_button)
    {
        lastClickedBtn = user_click_on_button; 
        originalBtnText = user_click_on_button.innerHTML;
        
        user_click_on_button.innerHTML = spinnerHtml;
    }
    
    ToggleUI(true);
}


function UnlockUI()
{
    //enable all buttons and input fields
    if (lastClickedBtn) 
    {
        lastClickedBtn.innerHTML = originalBtnText;
        lastClickedBtn = null; // reset for safety
    }

    ToggleUI(false);
}


function GoToLink(targetUrl) 
{
    const DELAY_TIME = 125;
    var menu = document.querySelector('.menu-container');

    if (menu) 
    {
        // Reset animation to allow re-triggering
        menu.style.animation = 'none';
        menu.offsetHeight; 
        menu.style.animation = null;

        // Add the exit class defined in CSS
        menu.classList.add('menu-exit');

        // Wait for animation to finish
        setTimeout(function() {window.location.href = targetUrl;}, DELAY_TIME);
    } 
    else 
    {
        window.location.href = targetUrl;
    }
}

// Handle all standard <a> links automatically
document.querySelectorAll('a').forEach(function(link) 
{
    link.addEventListener('click', function(event) 
    {
        if (link.href && !link.href.startsWith('javascript') && !link.href.includes('#') && link.target !== "_blank") {
            event.preventDefault();
            GoToLink(link.href);
        }
    });
});