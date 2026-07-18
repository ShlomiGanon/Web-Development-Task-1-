// Profiles page: list/select/add/remove/rename profiles and update the account user.

import
{
    escapeHtml, openModal, closeActiveModal, getActiveModal,
    getFormValuesFromModal, createUpdateUserModal, createConfirmationModal,
    buildChangedFields, failInModal, infoInModal,
    showMessage, showErrorMessage, clearMessage, goToLink,
    lockUi, unlockUi, isUiLocked, profileImageUrl
} from './ui.js';
import { Profile } from './api/models.js';
import { ClientSessionManager } from './core/session.js';
import { Backend, AVAILABLE_PROFILES_IMAGES } from './constants.js';

//=============== Constants ===============

let activeUser = null;

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

//=============== DOM references ===============

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

//=============== State ===============

/** @type {Array<Profile>} */
let profiles = [];
/** @type {Array<Profile>|null} */
let profilesBeforeChanges = null;
let isEditing = false;
let isDeleting = false;
let changeType = CHANGE_TYPE.NONE;

// Renders as an editable form while editing, read-only otherwise.
function currentRenderMode()
{
    return isEditing ? RENDER_MODE.EDIT : RENDER_MODE.VIEW;
}

function showCancelButton()
{
    elements.cancelButton.style.visibility = "visible";
    elements.cancelButton.style.opacity = 1;
}

function hideCancelButton()
{
    elements.cancelButton.style.visibility = "hidden";
    elements.cancelButton.style.opacity = 0;
}

function handleCancelClick()
{
    showMessage("השינויים בוטלו");
    setTimeout(() => { clearMessage(); }, 2000);
    profiles = profilesBeforeChanges.map(profile => Profile.fromJSON(profile));
    profilesBeforeChanges = null;
    isEditing = false;
    isDeleting = false;
    markAsUnchanged();
    renderProfiles(RENDER_MODE.VIEW);
}

//=============== Session / backend helpers ===============
// Token is stored locally by ClientSessionManager; read once and reused.

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
    const userResponse = await Backend.fetchActiveUserInfo(sessionToken);
    if (!userResponse.success)
    {
        return { success: false, message: userResponse.message };
    }
    activeUser = userResponse.user;
    if (activeUser.permission_level == 0)
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
    showErrorMessage(sessionResult.message);
    goToLink('/');
}
else
{
    profiles = sessionResult.profiles;
}

//=============== Edit-mode action buttons ===============

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

//=============== Change-tracking helpers ===============

function markAsUnchanged()
{
    changeType = CHANGE_TYPE.NONE;
    elements.manageProfileButton.innerText = "Manage Profiles";
    hideCancelButton();
    isEditing ? showEditActionButtons() : hideEditActionButtons();
}

function markAsChanged(newChangeType)
{
    profilesBeforeChanges = JSON.parse(JSON.stringify(profiles));
    changeType = newChangeType;
    elements.manageProfileButton.innerText = "Save Changes";
    hideEditActionButtons();
    showCancelButton();
}

// Typing in a name field marks the form changed so Manage saves instead of toggling.
function attachInputListeners()
{
    const inputs = document.querySelectorAll('.profile_input');
    inputs.forEach(input =>
    {
        input.addEventListener('input', () =>
        {
            if (!changeType) markAsChanged(CHANGE_TYPE.TEXT);
        });
    });
}

/**
 * Cycles a profile's avatar to the next image in AVAILABLE_PROFILES_IMAGES and marks
 * the change as pending (not yet saved to the server).
 * @param {Profile} profile
 */
function changeProfileImage(profile)
{
    if (!changeType) markAsChanged(CHANGE_TYPE.IMAGE);
    const currentIndex = AVAILABLE_PROFILES_IMAGES.indexOf(profile.ImageName);
    const nextIndex = (currentIndex === -1) ? 0 : (currentIndex + 1) % AVAILABLE_PROFILES_IMAGES.length;

    profile.ImageName = AVAILABLE_PROFILES_IMAGES[nextIndex];
    renderProfiles(RENDER_MODE.EDIT);
}

//=============== Rendering ===============

/**
 * Converts a single Profile into an HTML string.
 * EDIT renders an editable name field; VIEW renders read-only text. The name stays
 * read-only while an image change is pending, to avoid mixing two unsaved edits.
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
                        <img src="${profileImageUrl(safeImage)}" alt="${safeName}" class="img-fluid border border-3 border-dark">
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
                    <img src="${profileImageUrl(safeImage)}" alt="${safeName}" class="img-fluid border border-3 border-dark">
                </div>
                <div class="profile_name mt-3 text-secondary text-center" id="profile_name_${profile.id}">
                    ${safeName}
                </div>
            </div>
        `;
    }
}

/**
 * Renders every Profile in the `profiles` array into #profiles and (re)attaches their click listeners.
 * @param {string} [tagName=RENDER_MODE.VIEW] - one of RENDER_MODE.VIEW / RENDER_MODE.EDIT
 */
function renderProfiles(tagName = RENDER_MODE.VIEW)
{
    let allProfilesHtml = "";
    profiles.forEach(profile =>
    {
        allProfilesHtml += renderProfileComponent(profile, tagName);
    });

    elements.profilesArea.innerHTML = allProfilesHtml;

    if (isUiLocked)
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
        const cardElement = document.getElementById(`profile${profile.id}`);
        if (cardElement)
        {
            cardElement.addEventListener('click', () => handleProfileClick(profile));
        }
    });

    attachInputListeners();
}

//=============== UI lock helpers ===============

function lockUiAndProfiles(button)
{
    const isInside = elements.profilesArea.contains(button);
    lockUi(button);
    renderProfiles(currentRenderMode());
    if (isInside)
    {
        // Re-render clears the DOM; re-apply the spinner to the fresh element.
        unlockUi();
        const lockedElement = document.getElementById(button.id);
        lockUi(lockedElement ? lockedElement : null);
    }
}

function unlockUiAndProfiles()
{
    unlockUi();
    renderProfiles(currentRenderMode());
}

//=============== Event handlers ===============

async function handleManageProfilesClick()
{
    if (isUiLocked) return;

    if (!isEditing)
    {
        showMessage("לחץ על התמונה כדי לשנות אותה");
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
        // Lock during save; only leave edit mode if it succeeded.
        lockUi(elements.manageProfileButton);
        let saved = false;
        try
        {
            saved = await saveEditedProfiles();
        }
        finally
        {
            unlockUi();
        }

        if (!saved)
        {
            renderProfiles(RENDER_MODE.EDIT);
            return; // stay in edit mode to retry or cancel
        }
    }

    isEditing = !isEditing;
    elements.manageProfileButton.innerText = isEditing ? "Go Back" : "Manage Profiles";
    renderProfiles(currentRenderMode());
    isEditing ? showEditActionButtons() : hideEditActionButtons();
}

async function handleAddProfileClick()
{
    if (isUiLocked) return;

    // Lock while in flight so a double-click can't create two profiles.
    lockUi(elements.addProfileButton);
    try
    {
        const response = await Backend.createProfile(sessionToken);
        if (!response.success)
        {
            showErrorMessage(response.message);
        }
        else
        {
            showMessage("הפרופיל נוסף בהצלחה");
        }
        // createProfile() always returns the current list, so no fallback fetch needed.
        profiles = response.profiles;
    }
    catch (error)
    {
        console.error("createProfile request failed:", error);
        showErrorMessage("שגיאה בהוספת פרופיל, נסה שוב");
        // Leave profiles as-is; the server's actual state is unknown.
    }
    finally
    {
        unlockUi();
        renderProfiles(currentRenderMode());
    }
}

function handleRemoveProfileClick()
{
    if (isUiLocked) return;
    if (profiles.length <= 1)
    {
        showErrorMessage("אתה לא יכול למחוק את הפרופיל האחרון");
        return;
    }
    isDeleting = true;
    renderProfiles(RENDER_MODE.VIEW);
    hideEditActionButtons();

    elements.manageProfileButton.innerText = "Cancel Deletion";

    showMessage("לחץ על פרופיל כדי למחוק אותו");
}

async function saveEditedProfiles()
{
    for (const profile of profiles)
    {
        const input = document.getElementById(`profile_input_${profile.id}`);
        if (input && input.value.trim() === "")
        {
            showErrorMessage(`שם הפרופיל לא יכול להיות ריק`);
            return false;
        }
    }

    // Build the payload without mutating the live `profiles` array yet.
    const updatedProfiles = profiles.map(profile =>
    {
        const input = document.getElementById(`profile_input_${profile.id}`);
        if (!input) return profile;
        return profile.clone({ profileName: input.value });
    });

    try
    {
        const response = await Backend.saveProfiles(sessionToken, updatedProfiles);
        if (!response.success)
        {
            showErrorMessage(response.message);
            console.error("Error: " + response.message);
            return false;
        }

        // Commit locally only after server confirmation.
        profiles = updatedProfiles;
        showMessage("הפרופילים נשמרו בהצלחה");
        markAsUnchanged();
        return true;
    }
    catch (error)
    {
        console.error("saveProfiles request failed:", error);
        showErrorMessage("שגיאה בשמירת הפרופילים, נסה שוב");
        return false;
    }
}

/**
 * Prompts the user to confirm, then deletes the given profile via the backend and
 * re-renders the (now server-confirmed) profiles list.
 * @param {Profile} profile
 */
function confirmAndDeleteProfile(profile)
{
    if (profiles.length <= 1)
    {
        showMessage("Cannot delete the last profile. You must have at least one.");
        return;
    }

    openModal(() => createConfirmationModal(
        `Are you sure you want to delete profile "${profile.profileName}"?`,
        async () =>
        {
            const response = await Backend.deleteProfile(sessionToken, profile.id);
            if (!response || !response.success)
            {
                failInModal(response?.message || "שגיאה במחיקת הפרופיל");
                return;
            }
            // deleteProfile() always returns the current list, so no fallback fetch needed.
            profiles = response.profiles;
            infoInModal("הפרופיל נמחק בהצלחה");
            renderProfiles(RENDER_MODE.VIEW);
        }
    ));
}

function handleUpdateUserClick()
{
    if (isUiLocked) return;
    openModal(() => createUpdateUserModal(activeUser, updateUser));
}

async function updateUser(user)
{
    const formData = getFormValuesFromModal(getActiveModal());
    const changes = buildChangedFields(formData, user, { dateFields: ['birthday'] });

    if (Object.keys(changes).length === 0)
    {
        infoInModal("No changes to update");
        return;
    }

    const response = await Backend.updateActiveUserInfo(sessionToken, changes);
    if (!response.success)
    {
        failInModal("Update failed, server error: " + response.message);
        return;
    }
    if (!response.user)
    {
        failInModal("User update failed - invalid response from server.");
        return;
    }

    activeUser = response.user;
    infoInModal("User updated successfully");
}

/**
 * Handles a click on a profile card - deletes/edits/enters it depending on the current mode.
 * @param {Profile} profile
 */
async function handleProfileClick(profile)
{
    if (isUiLocked) return;
    if (isDeleting)
    {
        confirmAndDeleteProfile(profile);
    }
    else if (isEditing)
    {
        if (changeType === CHANGE_TYPE.IMAGE || changeType === CHANGE_TYPE.NONE)
        {
            changeProfileImage(profile);
        }
        else
        {
            showMessage("אתה נמצא במצב עריכה, נא ללחוץ על כפתור שמירה כדי לשמור על השינויים");
            return;
        }
    }
    else if (!isEditing)
    {
        const profileNameElement = document.getElementById(`profile_name_${profile.id}`);
        lockUiAndProfiles(profileNameElement ? profileNameElement : null);

        // Selecting a profile is local-only; it just records the active profile.
        try
        {
            ClientSessionManager.setActiveProfileId(profile.id);
            showMessage(`Entering ${profile.profileName}...`);
            goToLink("../html/profile.html");
        }
        catch (error)
        {
            console.error("Failed to set active profile:", error);
            showErrorMessage("שגיאה בבחירת הפרופיל, נסה שנית");
            unlockUiAndProfiles();
        }
    }
}

async function handleLogoutClick()
{
    if (isUiLocked) return;

    lockUiAndProfiles(elements.logoutButton);
    try
    {
        const response = await Backend.logout(sessionToken);
        if (response && response.success)
        {
            ClientSessionManager.deleteSessionToken();
            ClientSessionManager.deleteActiveProfileId();
            showMessage("התנתקות בוצעה בהצלחה , מתבצעת העברה...");
            goToLink('../html/login.html');
            // Left locked; already navigating away.
        }
        else
        {
            showErrorMessage(response?.message || "שגיאה בהתנתקות, נסה שוב");
            unlockUiAndProfiles();
        }
    }
    catch (error)
    {
        console.error("Logout request failed:", error);
        showErrorMessage("שגיאה בהתנתקות, נסה שוב");
        unlockUiAndProfiles();
    }
}

function handleAdminDashboardClick()
{
    if (activeUser.permission_level == 0)
    {
        showErrorMessage("אין לך הרשאות לגשת ללוח המנהל");
        return;
    }
    lockUi(elements.adminDashboardButton);
    goToLink('../html/admin.html');
}

//=============== Main ===============

elements.logoutButton.addEventListener('click', handleLogoutClick);
elements.adminDashboardButton.addEventListener('click', handleAdminDashboardClick);
elements.manageProfileButton.addEventListener('click', handleManageProfilesClick);
elements.addProfileButton.addEventListener('click', handleAddProfileClick);
elements.removeProfileButton.addEventListener('click', handleRemoveProfileClick);
elements.cancelButton.addEventListener('click', handleCancelClick);
elements.updateUserButton.addEventListener('click', handleUpdateUserClick);
hideCancelButton();
renderProfiles();
