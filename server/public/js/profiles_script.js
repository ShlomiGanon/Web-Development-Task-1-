import * as UI from './ui-utils.js';
import { Profile } from './BACKEND_API/backend-interface.js';
import { ClientSessionManager } from './client-session-manager.js';
import { Backend } from './config.js';
import * as Constants from './constances.js';
import { AVAILABLE_PROFILES_IMAGES } from './config.js';

// ==========================================
//               Constants
// ==========================================

// What kind of unsaved change is currently pending in edit mode.
const CHANGE_TYPE = Object.freeze({
    NONE: null,
    TEXT: 'text',
    IMAGE: 'image'
});

// The two ways a profile card can be rendered.
const RENDER_MODE = Object.freeze({
    VIEW: 'div',
    EDIT: 'input'
});

// ==========================================
//              DOM References
// ==========================================

const elements = {
    profilesArea: document.getElementById('profiles'),
    manageProfileButton: document.getElementById('manage-profile-button'),
    addProfileButton: document.getElementById('add-profile-button'),
    removeProfileButton: document.getElementById('remove-profile-button'),
    logoutButton: document.getElementById('logout-button'),
    cancelButton: document.getElementById('cancel-button')
};

// ==========================================
//                  State
// ==========================================

/** @type {Array<Profile>} */
let profiles = [];
/** @type {Array<Profile>|null} */
let profile_before_changes = null;
let isEditing = false;
let isDeleting = false;
let changeType = CHANGE_TYPE.NONE;

// Renders as an editable form while editing, read-only otherwise.
function currentRenderMode()
{
    return isEditing ? RENDER_MODE.EDIT : RENDER_MODE.VIEW;
}

function ShowCancelButton()
{
    elements.cancelButton.style.visibility = "visible";
    elements.cancelButton.style.opacity = 1;
}

function HideCancelButton()
{
    elements.cancelButton.style.visibility = "hidden";
    elements.cancelButton.style.opacity = 0;
}

function Cancel_Click()
{
    UI.ShowMessage("השינויים בוטלו");
    setTimeout(() => {
        UI.ClearMessage();
    }, 2000);
    profiles = profile_before_changes.map(profile => Profile.fromJSON(profile));
    profile_before_changes = null;
    isEditing = false;
    isDeleting = false;
    markAsUnchanged();
    renderProfiles(RENDER_MODE.VIEW);
}

// ==========================================
//        Session / Backend helpers
// ==========================================
// All server communication goes through Backend directly; ClientSessionManager only
// stores the token/active-profile-id locally, so we read the token once and reuse it.

const sessionToken = ClientSessionManager.getSessionToken();

/**
 * Validates the current session against the backend and, if valid, fetches the user's profiles.
 * @returns {Promise<{success: boolean, message?: string, profiles?: Array<Profile>}>}
 */
async function restoreActiveSession()
{
    const isValid = await ClientSessionManager.isLoggedIn(true);
    if (!isValid)
    {
        return { success: false, message: "ההתחברות פגה, אנא התחבר מחדש" };
    }

    const profilesResponse = await Backend.fetchAllProfiles(sessionToken);
    if (!profilesResponse.success)
    {
        return { success: false, message: profilesResponse.message };
    }

    return { success: true, profiles: profilesResponse.profiles };
}

const sessionResult = await restoreActiveSession();
if (!sessionResult.success)
{
    UI.ShowErrorMessage(sessionResult.message);

    // Wrapped setTimeout in a Promise so await can properly delay the execution
    // and the code not continue to load the page before the timeout is over
    await new Promise(resolve => setTimeout(resolve, 2000));

    UI.GoToLink('/'); // redirect to login page
}
else
{
    profiles = sessionResult.profiles;
}

// ==========================================
//         Edit-mode action buttons
// ==========================================

function showEditActionButtons()
{
    elements.addProfileButton.disabled = false;
    elements.addProfileButton.style.visibility = "visible";
    elements.addProfileButton.style.opacity = 1;

    elements.removeProfileButton.disabled = false;
    elements.removeProfileButton.style.visibility = "visible";
    elements.removeProfileButton.style.opacity = 1;
}

function hideEditActionButtons()
{
    elements.addProfileButton.disabled = true;
    elements.addProfileButton.style.visibility = "hidden";
    elements.addProfileButton.style.opacity = 0;

    elements.removeProfileButton.disabled = true;
    elements.removeProfileButton.style.visibility = "hidden";
    elements.removeProfileButton.style.opacity = 0;
}

// ==========================================
//         Change-tracking helpers
// ==========================================

function markAsUnchanged()
{
    changeType = CHANGE_TYPE.NONE;
    elements.manageProfileButton.innerText = "Manage Profiles";
    HideCancelButton();
    isEditing ? showEditActionButtons() : hideEditActionButtons(); 
}

function markAsChanged(newChangeType)
{
    profile_before_changes = JSON.parse(JSON.stringify(profiles));
    changeType = newChangeType;
    elements.manageProfileButton.innerText = "Save Changes";
    hideEditActionButtons();
    ShowCancelButton();
}

// When the user starts typing in a profile name field, mark the form as changed
// so ManageProfiles_Click knows to save instead of just toggling edit mode.
function attachInputListeners()
{
    const inputs = document.querySelectorAll('.profile_input');
    inputs.forEach(input =>
    {
        input.addEventListener('input', () => {
            if (!changeType) markAsChanged(CHANGE_TYPE.TEXT);
        });
    });
}

/**
 * Cycles a profile's avatar to the next image in AVAILABLE_PROFILES_IMAGES and marks
 * the change as pending (not yet saved to the server).
 * @param {Profile} profile
 */
async function changeProfileImage(profile)
{
    if(!changeType)markAsChanged(CHANGE_TYPE.IMAGE);
    const currentIndex = AVAILABLE_PROFILES_IMAGES.indexOf(profile.imageName);
    const nextIndex = (currentIndex === -1) ? 0 : (currentIndex + 1) % AVAILABLE_PROFILES_IMAGES.length;

    profile.imageName = AVAILABLE_PROFILES_IMAGES[nextIndex];
    renderProfiles(RENDER_MODE.EDIT);
}

// ==========================================
//              Rendering
// ==========================================

/**
 * Converts a single Profile into an HTML string.
 * RENDER_MODE.EDIT renders an editable name field; RENDER_MODE.VIEW renders read-only text.
 * NOTE: even in EDIT mode, the name stays read-only while an image change is still
 * pending (changeType === IMAGE), to avoid mixing two different unsaved edits at once.
 * @param {Profile} profile
 * @param {string} [tagName=RENDER_MODE.VIEW] - one of RENDER_MODE.VIEW / RENDER_MODE.EDIT
 * @returns {string} HTML markup for this profile's card
 */
function renderProfileComponent(profile, tagName = RENDER_MODE.VIEW)
{
    if (tagName === RENDER_MODE.EDIT && (changeType === CHANGE_TYPE.TEXT || changeType === CHANGE_TYPE.NONE))
    {
        return `
            <div>
                <div class="profile" id="profile${profile.id}" style="cursor: pointer;">
                    <div class="profile_image">
                        <img src="../assets/profiles_images/${profile.imageName}" alt="${profile.name}" class="img-fluid border border-3 border-dark">
                    </div>
                </div>
                <input id="profile_input_${profile.id}" autocomplete="off" type="text" class="profile_input mt-3 text-secondary text-center" value="${profile.name}">
            </div>
        `;
    }
    else
    {
        return `
            <div class="profile" id="profile${profile.id}" style="cursor: pointer;">
                <div class="profile_image">
                    <img src="../assets/profiles_images/${profile.imageName}" alt="${profile.name}" class="img-fluid border border-3 border-dark">
                </div>
                <div class="profile_name mt-3 text-secondary text-center" id="profile_name_${profile.id}">
                    ${profile.name}
                </div>
            </div>
        `;
    }
}

/**
 * Renders every Profile in the `profiles` array into #profiles and (re)attaches
 * their click listeners.
 * @param {string} [tagName=RENDER_MODE.VIEW] - one of RENDER_MODE.VIEW / RENDER_MODE.EDIT
 */
function renderProfiles(tagName = RENDER_MODE.VIEW)
{
    let allProfilesHTML = "";
    profiles.forEach(profile =>
    {
        allProfilesHTML += renderProfileComponent(profile, tagName);
    });

    elements.profilesArea.innerHTML = allProfilesHTML;

    if (UI.isUILocked)
    {
        elements.profilesArea.style.pointerEvents = "none";
        elements.profilesArea.style.opacity = "0.6";
    }
    else
    {
        elements.profilesArea.style.pointerEvents = "auto";
        elements.profilesArea.style.opacity = "1";
    }

    profiles.forEach(profile =>
    {
        const el = document.getElementById(`profile${profile.id}`);
        if (el)
        {
            el.addEventListener('click', () => Profile_Click(profile));
        }
    });

    attachInputListeners();
}

// ==========================================
//            UI lock helpers
// ==========================================

function lockUIAndProfiles(button)
{
    const isInside = elements.profilesArea.contains(button);
    UI.LockUI(button);
    renderProfiles(currentRenderMode());
    if (isInside)
    {
        // The render process clears the UI, so we unlock the global state
        // and re-apply the spinner to the specific element in the new DOM.
        UI.UnlockUI();
        const lockedElement = document.getElementById(button.id);
        UI.LockUI(lockedElement ? lockedElement : null);
    }
}

function unlockUIAndProfiles()
{
    UI.UnlockUI();
    renderProfiles(currentRenderMode());
}

// ==========================================
//             Event handlers
// ==========================================

async function ManageProfiles_Click()
{
    if(!isEditing)
    {
        UI.ShowMessage("לחץ על התמונה כדי לשנות אותה");
    }
    if (isDeleting)
    {
        isDeleting = false;
        elements.manageProfileButton.innerText = "Go Back";
        renderProfiles(RENDER_MODE.EDIT);
        showEditActionButtons();
        return;
    }

    if (isEditing && changeType)
    {
        await saveEditedProfiles();
    }

    isEditing = !isEditing;
    elements.manageProfileButton.innerText = isEditing ? "Go Back" : "Manage Profiles";
    renderProfiles(currentRenderMode());
    isEditing ? showEditActionButtons() : hideEditActionButtons();
}

async function AddProfile_Click()
{
    if (UI.isUILocked) return;

    const response = await Backend.createProfile(sessionToken);
    if (!response.success)
    {
        UI.ShowErrorMessage(response.message);
    }
    else
    {
        UI.ShowMessage("הפרופיל נוסף בהצלחה");
    }
    // createProfile() returns the current profiles list whether it succeeded or not
    // (e.g. when the 4-profile limit is hit), so no separate fallback fetch is needed.
    profiles = response.profiles;
    renderProfiles(currentRenderMode());
}

function RemoveProfile_Click()
{
    if (UI.isUILocked) return;
    if (profiles.length <= 1)
    {
        UI.ShowErrorMessage("אתה לא יכול למחוק את הפרופיל האחרון");
        return;
    }
    isDeleting = true;
    renderProfiles(RENDER_MODE.VIEW);
    hideEditActionButtons();

    elements.manageProfileButton.innerText = "Cancel Deletion";

    UI.ShowMessage("לחץ על פרופיל כדי למחוק אותו");
}

// Validates and persists the currently edited profile names (called when leaving edit mode).
async function saveEditedProfiles()
{
    for (const profile of profiles)
    {
        const input = document.getElementById(`profile_input_${profile.id}`);
        if (input && input.value.trim() === "")
        {
            UI.ShowErrorMessage(`שם הפרופיל לא יכול להיות ריק`);
            return;
        }
    }

    profiles.forEach(profile =>
    {
        const input = document.getElementById(`profile_input_${profile.id}`);
        if (input) profile.name = input.value;
    });

    const response = await Backend.saveProfiles(sessionToken, profiles);
    if (!response.success)
    {
        UI.ShowErrorMessage(response.message);
        console.error("Error: " + response.message);
    }
    else
    {
        UI.ShowMessage("הפרופילים נשמרו בהצלחה");
        markAsUnchanged();
    }
}

/**
 * Prompts the user to confirm, then deletes the given profile via the backend
 * and re-renders the (now server-confirmed) profiles list.
 * @param {Profile} profile
 */
async function confirmAndDeleteProfile(profile)
{
    if (profiles.length <= 1)
    {
        UI.ShowMessage("Cannot delete the last profile. You must have at least one.");
        return;
    }
    const confirmed = confirm(`Are you sure you want to delete profile "${profile.name}"?`);
    if (confirmed)
    {
        const response = await Backend.deleteProfile(sessionToken, profile.id);

        if (!response || !response.success)
        {
            UI.ShowErrorMessage(response?.message || "שגיאה במחיקת הפרופיל");
        }
        else
        {
            UI.ShowMessage("הפרופיל נמחק בהצלחה");
        }

        // deleteProfile() returns the current profiles list whether it succeeded or not
        // (e.g. when trying to delete the last remaining profile), so no separate
        // fallback fetch is needed.
        profiles = response.profiles;

        renderProfiles(RENDER_MODE.VIEW);
    }
}

/**
 * Handles a click on a profile card - deletes/edits/enters it depending on the
 * current mode (isDeleting / isEditing / normal).
 * @param {Profile} profile
 */
async function Profile_Click(profile)
{
    if (UI.isUILocked) return;
    if (isDeleting)
    {
        confirmAndDeleteProfile(profile);
    }
    else if (isEditing)
    {
        if (changeType === CHANGE_TYPE.IMAGE || changeType === CHANGE_TYPE.NONE) changeProfileImage(profile);
        else
        {
            UI.ShowMessage("אתה נמצא במצב עריכה, נא ללחוץ על כפתור שמירה כדי לשמור על השינויים");
            return;
        }
    }
    else if (!isEditing)
    {
        const profileNameElement = document.getElementById(`profile_name_${profile.id}`);
        lockUIAndProfiles(profileNameElement ? profileNameElement : null);
        UI.ShowMessage(`Entering ${profile.name}...`);

        // Selecting a profile is a local-only action (no backend route for it) -
        // it just records which profile is active for this tab/session.
        try
        {
            ClientSessionManager.setActiveProfileId(profile.id);
            setTimeout(() =>
            {
                UI.GoToLink("../html/profile.html");
            }, 2000);
        }
        catch (error)
        {
            console.error("Failed to set active profile:", error);
            UI.ShowErrorMessage("שגיאה בבחירת הפרופיל, נסה שנית");
            unlockUIAndProfiles();
        }
    }
}

async function Logout_Click()
{
    lockUIAndProfiles(elements.logoutButton);
    const response = await Backend.logout(sessionToken);
    if (response && response.success)
    {
        ClientSessionManager.deleteSessionToken();
        ClientSessionManager.deleteActiveProfileId();
        UI.ShowMessage("התנתקות בוצעה בהצלחה , מתבצעת העברה...");
        setTimeout(() =>
        {
            UI.GoToLink('../html/login_menu.html');
        }, 2000);
    }
    else
    {
        UI.ShowErrorMessage(response.message);
        unlockUIAndProfiles();
    }
}

// ==========================================
//                  MAIN
// ==========================================

if (!(await ClientSessionManager.isLoggedIn()))
{
    UI.GoToLink('../html/login_menu.html');
}

elements.logoutButton.addEventListener('click', Logout_Click);
elements.manageProfileButton.addEventListener('click', ManageProfiles_Click);
elements.addProfileButton.addEventListener('click', AddProfile_Click);
elements.removeProfileButton.addEventListener('click', RemoveProfile_Click);
elements.cancelButton.addEventListener('click', Cancel_Click);
HideCancelButton();
renderProfiles();