import * as UI from './ui-utils.js';
import { Profile, UserInfo } from './BACKEND_API/backend-interface.js';
import { ClientSessionManager } from './client-session-manager.js';
import { Backend } from './config.js';
import * as Constants from './constances.js';
import { AVAILABLE_PROFILES_IMAGES } from './config.js';
let active_user = null;
let update_user_window = null;
let update_user_listener = null;
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
    adminDashboardButton: document.getElementById('admin-dashboard-button'),
    logoutButton: document.getElementById('logout-button'),
    cancelButton: document.getElementById('cancel-button'),
    updateUserButton: document.getElementById('update-user-button')
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

function escapeHtml(value)
{
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
    const user_response = await Backend.fetchActiveUserInfo(sessionToken);
    if (!user_response.success)
    {
        return { success: false, message: user_response.message };
    }
    active_user = user_response.user;
    if (active_user.permission_level == 0)
    {
        elements.adminDashboardButton.style.cursor = "not-allowed";
        elements.adminDashboardButton.style.opacity = 0.5;
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
    const currentIndex = AVAILABLE_PROFILES_IMAGES.indexOf(profile.ImageName);
    const nextIndex = (currentIndex === -1) ? 0 : (currentIndex + 1) % AVAILABLE_PROFILES_IMAGES.length;

    profile.ImageName = AVAILABLE_PROFILES_IMAGES[nextIndex];
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
    const safeName = escapeHtml(profile.profileName);
    const safeImage = escapeHtml(profile.ImageName);

    if (tagName === RENDER_MODE.EDIT && (changeType === CHANGE_TYPE.TEXT || changeType === CHANGE_TYPE.NONE))
    {
        return `
            <div>
                <div class="profile" id="profile${profile.id}" style="cursor: pointer;">
                    <div class="profile_image">
                        <img src="../assets/profiles_images/${safeImage}" alt="${safeName}" class="img-fluid border border-3 border-dark">
                    </div>
                </div>
                <input id="profile_input_${profile.id}" autocomplete="off" type="text" class="profile_input mt-3 text-secondary text-center" value="${safeName}">
            </div>
        `;
    }
    else
    {
        return `
            <div class="profile" id="profile${profile.id}" style="cursor: pointer;">
                <div class="profile_image">
                    <img src="../assets/profiles_images/${safeImage}" alt="${safeName}" class="img-fluid border border-3 border-dark">
                </div>
                <div class="profile_name mt-3 text-secondary text-center" id="profile_name_${profile.id}">
                    ${safeName}
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
    if (UI.isUILocked) return;

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
        // lock the UI during the save request, and only leave edit mode if the
        // save actually succeeded.
        UI.LockUI(elements.manageProfileButton);
        let saved = false;
        try
        {
            saved = await saveEditedProfiles();
        }
        finally
        {
            UI.UnlockUI();
        }

        if (!saved)
        {
            renderProfiles(RENDER_MODE.EDIT);
            return; // stay in edit mode so the user can retry or cancel
        }
    }

    isEditing = !isEditing;
    elements.manageProfileButton.innerText = isEditing ? "Go Back" : "Manage Profiles";
    renderProfiles(currentRenderMode());
    isEditing ? showEditActionButtons() : hideEditActionButtons();
}

async function AddProfile_Click()
{
    if (UI.isUILocked) return;

    // lock the UI while the request is in flight, so a fast double-click can't
    // fire two create-profile requests.
    UI.LockUI(elements.addProfileButton);
    try
    {
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
    }
    catch (error)
    {
        console.error("createProfile request failed:", error);
        UI.ShowErrorMessage("שגיאה בהוספת פרופיל, נסה שוב");
        // profiles is left as-is here - we don't know what the server actually did.
    }
    finally
    {
        UI.UnlockUI();
        renderProfiles(currentRenderMode());
    }
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


async function saveEditedProfiles()
{
    for (const profile of profiles)
    {
        const input = document.getElementById(`profile_input_${profile.id}`);
        if (input && input.value.trim() === "")
        {
            UI.ShowErrorMessage(`שם הפרופיל לא יכול להיות ריק`);
            return false;
        }
    }

    // Build the payload to send without touching the live `profiles` array yet.
    const updatedProfiles = profiles.map(profile =>
    {
        const input = document.getElementById(`profile_input_${profile.id}`);
        if (!input) return profile;
        const clone = Profile.fromJSON(JSON.parse(JSON.stringify(profile)));
        clone.profileName = input.value;
        return clone;
    });

    try
    {
        const response = await Backend.saveProfiles(sessionToken, updatedProfiles);
        if (!response.success)
        {
            UI.ShowErrorMessage(response.message);
            console.error("Error: " + response.message);
            return false;
        }

        // Only now, after server confirmation, do we commit the new names locally.
        profiles = updatedProfiles;
        UI.ShowMessage("הפרופילים נשמרו בהצלחה");
        markAsUnchanged();
        return true;
    }
    catch (error)
    {
        console.error("saveProfiles request failed:", error);
        UI.ShowErrorMessage("שגיאה בשמירת הפרופילים, נסה שוב");
        return false;
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
    const confirmed = confirm(`Are you sure you want to delete profile "${profile.profileName}"?`);
    if (!confirmed) return;

    if (UI.isUILocked) return;
    UI.LockUI(null);
    try
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
    }
    catch (error)
    {
        console.error("deleteProfile request failed:", error);
        UI.ShowErrorMessage("שגיאה במחיקת הפרופיל, נסה שוב");
        // profiles is left as-is here - we don't know what the server actually did.
    }
    finally
    {
        UI.UnlockUI();
        renderProfiles(RENDER_MODE.VIEW);
    }
}

function UpdateUser_Click()
{
    if (UI.isUILocked) return;
    update_user_window = create_update_user_window(active_user, update_user);
}

async function update_user(user)
{
    const form_data = get_filters_from_window(update_user_window);
    let changes = {};
    const date_fields = ['birthday'];

    for (const key in form_data)
    {
        if (key === 'password')
        {
            if (form_data[key] !== "") changes[key] = form_data[key];
            continue;
        }

        if (!(key in user)) continue;
        if (form_data[key] === "") continue;

        let original_value;
        if (date_fields.includes(key))
        {
            original_value = user[key] ? new Date(user[key]).toISOString().split('T')[0] : '';
        }
        else
        {
            original_value = String(user[key] ?? '');
        }

        if (form_data[key] !== original_value)
        {
            changes[key] = form_data[key];
        }
    }

    if (Object.keys(changes).length === 0)
    {
        close_filters_window();
        UI.ShowMessage("No changes to update");
        return;
    }

    const response = await Backend.updateActiveUserInfo(sessionToken, changes);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("Update failed, server error: " + response.message);
        return;
    }
    if (!response.user)
    {
        close_filters_window();
        UI.ShowErrorMessage("User update failed - invalid response from server.");
        return;
    }

    UI.ShowMessage("User updated successfully");
    active_user = response.user;
    close_filters_window();
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
        UI.ShowMessage(`Entering ${profile.profileName}...`);

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
    if (UI.isUILocked) return;

    lockUIAndProfiles(elements.logoutButton);
    try
    {
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
            // Intentionally left locked here - we're already navigating away.
        }
        else
        {
            UI.ShowErrorMessage(response?.message || "שגיאה בהתנתקות, נסה שוב");
            unlockUIAndProfiles();
        }
    }
    catch (error)
    {
        console.error("Logout request failed:", error);
        UI.ShowErrorMessage("שגיאה בהתנתקות, נסה שוב");
        unlockUIAndProfiles();
    }
}

function AdminDashboard_Click()
{
    if (active_user.permission_level == 0)
    {
        UI.ShowErrorMessage("אין לך הרשאות לגשת ללוח המנהל");
        return;
    }
    UI.LockUI(elements.adminDashboardButton);
    UI.GoToLink('../html/admin_dashboard.html');
}

const FIELD_ITEM_CLASSES = "col-12 d-flex justify-content-between align-items-center border border-secondary p-2 m-2";
const LABEL_CLASSES = "text-start fw-bold fs-5 text-secondary";
const INPUT_CLASSES = "form-control w-75";
const SELECT_CLASSES = "form-select w-75";
const FIELD_GROUP_CLASSES = "col-12 col-lg-5 text-start border border-dark m-1 p-2";
const FIELD_GROUP_NAME_CLASSES = "text-start fw-bold text-primary mb-4 fs-4";
const FIELDS_CONTAINER_CLASSES = "col-12 row d-flex justify-content-evenly align-items-start";
const HAVE_VALUE_CLASS = "text-success";
const NEW_VALUE_CLASS = "text-warning";

function build_edit_input_field(target, label, text, type)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = text;
    field.appendChild(label_p);

    const input = document.createElement('input');
    input.type = type;
    input.id = label;
    input.className = INPUT_CLASSES;

    if (target && target[label] !== undefined)
    {
        if (Array.isArray(target[label]))
        {
            input.value = target[label].join(", ");
        }
        else
        {
            input.value = (type === 'date') ? new Date(target[label]).toISOString().split('T')[0] : target[label];
        }
    }

    input.addEventListener('input', () =>
    {
        let original_value = target ? target[label] : '';
        if (Array.isArray(original_value))
        {
            original_value = original_value.join(", ");
        }
        else if (type === 'date')
        {
            original_value = target ? new Date(original_value).toISOString().split('T')[0] : '';
        }
        const unchanged = input.value === '' || (target && input.value === original_value);
        label_p.classList.toggle(NEW_VALUE_CLASS, !unchanged);
    });

    field.appendChild(input);
    return field;
}

function build_edit_select_field(target, label, text, options)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = text;
    field.appendChild(label_p);

    const select = document.createElement('select');
    select.id = label;
    select.className = SELECT_CLASSES;
    options.forEach(option =>
    {
        const option_element = document.createElement('option');
        option_element.value = option;
        option_element.textContent = option;
        select.appendChild(option_element);
    });

    if (target && target[label] && target[label] !== options[0])
    {
        select.value = target[label];
    }

    select.addEventListener('change', () =>
    {
        const unchanged = select.value === options[0] || (target && select.value === target[label]);
        label_p.classList.toggle(NEW_VALUE_CLASS, !unchanged);
    });

    field.appendChild(select);
    return field;
}

function create_button_row(buttons)
{
    const row = document.createElement('div');
    row.className = 'col-12 d-flex justify-content-evenly align-items-center';
    buttons.forEach(({ text, className, onClick, listenForEnter }) =>
    {
        const btn = document.createElement('button');
        btn.className = className;
        btn.textContent = text;
        btn.addEventListener('click', async () =>
        {
            if (UI.isUILocked) return;
            UI.LockUI(btn);
            try
            {
                await onClick();
            }
            finally
            {
                UI.UnlockUI();
            }
        });
        if (listenForEnter) add_filters_listener(btn);
        row.appendChild(btn);
    });
    return row;
}

function add_filters_listener(enter_like_press_button)
{
    const handler = (event) =>
    {
        if (event.key === 'Escape') close_filters_window();
        if (event.key === 'Enter') enter_like_press_button.click();
    };
    document.addEventListener('keydown', handler);
    update_user_listener = handler;
}


function create_modal_shell(titleText, { widthClass = 'col-10', titleClass = 'mb-3 text-danger fw-bold fs-1' } = {})
{
    const overlay = document.createElement('div');
    overlay.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75';
    overlay.style.zIndex = '1050';

    const content = document.createElement('div');
    content.className = `${widthClass} bg-dark bg-opacity-75 p-4 rounded shadow-lg text-center`;
    content.style.maxHeight = '90vh';
    content.style.overflowY = 'auto';

    const title = document.createElement('h1');
    title.className = titleClass;
    title.textContent = titleText;
    content.appendChild(title);

    overlay.appendChild(content);
    return { overlay, content };
}

function get_filters_from_window(filters_window)
{
    const filters = {};
    filters_window.querySelectorAll('input').forEach(input => { filters[input.id] = input.value; });
    filters_window.querySelectorAll('select').forEach(select => { filters[select.id] = select.value; });
    return filters;
}

function close_filters_window()
{
    if (update_user_window)
    {
        update_user_window.remove();
        update_user_window = null;
    }
    if (update_user_listener)
    {
        document.removeEventListener('keydown', update_user_listener);
        update_user_listener = null;
    }
}

function create_update_user_window(user , primary_button_func = null)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return null;
    }

    const { overlay, content } = create_modal_shell('Update User');

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);

    // maps to: { email, phone, fullName, birthday } on UserInfo
    fields_container.appendChild(build_edit_input_field(user, 'email', "Email", 'text'));
    fields_container.appendChild(build_edit_input_field(user, 'phone', "Phone", 'text'));
    fields_container.appendChild(build_edit_input_field(user, 'fullName', "Full Name", 'text'));
    fields_container.appendChild(build_edit_input_field(user, 'birthday', "Birth Date", 'date'));
    fields_container.appendChild(build_edit_input_field(user, 'password', "Set New password", 'password'));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: 'Update', className: 'btn btn-primary btn-lg', onClick: () => primary_button_func ? primary_button_func(user) : update_user(user), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

// ==========================================
//                  MAIN
// ==========================================


elements.logoutButton.addEventListener('click', Logout_Click);
elements.adminDashboardButton.addEventListener('click', AdminDashboard_Click);
elements.manageProfileButton.addEventListener('click', ManageProfiles_Click);
elements.addProfileButton.addEventListener('click', AddProfile_Click);
elements.removeProfileButton.addEventListener('click', RemoveProfile_Click);
elements.cancelButton.addEventListener('click', Cancel_Click);
elements.updateUserButton.addEventListener('click', UpdateUser_Click);
HideCancelButton();
renderProfiles();