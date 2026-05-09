let isUILocked = false;
let lastClickedBtn = null;
let originalBtnText = "";
const spinnerHtml = '<div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>';

function ToggleUI(isDisabled) 
{
    isUILocked = isDisabled;
    const inputs = document.querySelectorAll('button, input, textarea, select');
    inputs.forEach(el => 
        {
            el.disabled = isDisabled;
        }
    );

    const links = document.querySelectorAll('a');
    links.forEach(link => 
        {
            link.style.pointerEvents = isDisabled ? "none" : "auto";
        }
    );
}
/**
 * @param {HTMLButtonElement | null} clicked_button
 */
function LockUI(clicked_button = null)
{
    if (isUILocked) 
    {
        throw new Error("UI is already locked");
    }
    if (clicked_button)
    {
        lastClickedBtn = clicked_button; 
        originalBtnText = clicked_button.innerHTML;   
        clicked_button.innerHTML = spinnerHtml;
    }
    ToggleUI(true);
}


function UnlockUI()
{
    if (!isUILocked) 
    {
        throw new Error("UI is not locked");
    }
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