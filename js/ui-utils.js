let isUILocked = false;
let lastClickedBtn = null;
let originalBtnText = "";
const spinnerHtml = '<div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>';
const msgbox = document.getElementById('msg_box');

/**
 * Displays a standard informative message in the UI.
 * @param {string} message - The text to display.
 */
export function ShowMessage(message) 
{
    if (msgbox) msgbox.innerHTML = `<div class="msg">${message}</div>`;
    else console.log("Message box not found: ", msgbox);
}

/**
 * Displays an error-styled message in the UI.
 * @param {string} message - The error text to display.
 */
export function ShowErrorMessage(message) 
{
    if (msgbox) msgbox.innerHTML = `<div class="msg_error">${message}</div>`;
    else console.log("Message box not found: ", msgbox);
}

/**
 * Removes all content from the designated message box.
 */
export function ClearMessage() 
{
    if(msgbox)msgbox.innerHTML = '';
}


/**
 * Disables or enables all interactive UI elements to prevent user interference.
 * @param {boolean} isDisabled - True to lock the UI, false to unlock.
 */
export function ToggleUI(isDisabled) 
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
 * Locks the UI and applies a loading state to the triggering element.
 * @param {HTMLButtonElement|null} [triggerBtn=null] - The element that invoked the process, used to display a spinner.
 */
export function LockUI(clicked_button = null)
{
    if (isUILocked) 
    {
        console.log("UI is already locked");
        return;
    }
    if (clicked_button)
    {
        lastClickedBtn = clicked_button; 
        originalBtnText = clicked_button.innerHTML;   
        clicked_button.innerHTML = spinnerHtml;
    }
    ToggleUI(true);
}


/**
 * Releases the UI lock and restores the original state of the button that initiated the action.
 */
export function UnlockUI()
{
    if (!isUILocked) 
    {
        console.log("UI is not locked");
        return;
    }
    //enable all buttons and input fields
    if (lastClickedBtn) 
    {
        lastClickedBtn.innerHTML = originalBtnText;
        lastClickedBtn = null; // reset for safety
    }

    ToggleUI(false);
}

/**
 * Executes a smooth page transition with an exit animation.
 * Forces a reflow to reset animations and navigates once the transition delay expires.
 * @param {string} targetUrl - The destination path or URL for navigation.
 */
export function GoToLink(targetUrl) 
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
document.addEventListener('click', function(event) {
    // Find the closest anchor tag, even if a nested element (like an icon) was clicked
    const link = event.target.closest('a'); 
    
    // Validate if the link is a standard internal navigation link
    if (link && link.href && 
        !link.href.startsWith('javascript') && 
        !link.href.includes('#') && 
        link.target !== "_blank") {
        
        // Prevent the browser's default immediate navigation
        event.preventDefault();

        // If UI is currently locked (processing), stop further execution
        if (isUILocked) return;
        
        // Trigger the custom navigation logic with exit animations
        GoToLink(link.href);
    }
});