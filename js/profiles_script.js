import * as UI from './ui-utils.js';
import { Profile } from './BACKEND_API/backend-interface.js';
import { ClientSessionManager } from './clientSessionManager.js';
import * as Constants from './constances.js';
import { AVAILABLE_PROFILES_IMAGES } from './config.js';
//variables

let isEditing = false;
let isDeleting = false;
let HasChanged = false;


const profiles_area = document.getElementById('profiles');
const manage_profile_button = document.getElementById('manage-profile-button');
const add_profile_button = document.getElementById('add-profile-button');
const remove_profile_button = document.getElementById('remove-profile-button');
const logout_button = document.getElementById('logout-button');



//profiles array
let profiles = [];


async function changeProfileImage(profile) 
{
    const currentIndex = AVAILABLE_PROFILES_IMAGES.indexOf(profile.imageName);
    const nextIndex = (currentIndex === -1) ? 0 : (currentIndex + 1) % AVAILABLE_PROFILES_IMAGES.length;
    
    profile.imageName = AVAILABLE_PROFILES_IMAGES[nextIndex];
    markAsChanged("image");
    renderProfiles('input'); 
}

//show edit action buttons (add and remove profile buttons)
function showEditActionButtons() 
{
    add_profile_button.disabled = false;
    add_profile_button.style.visibility = "visible";
    add_profile_button.style.opacity = 1;

    remove_profile_button.disabled = false;
    remove_profile_button.style.visibility = "visible";
    remove_profile_button.style.opacity = 1;
}

//hide edit action buttons (add and remove profile buttons)
function hideEditActionButtons() 
{
    add_profile_button.disabled = true;
    add_profile_button.style.visibility = "hidden";
    add_profile_button.style.opacity = 0;

    remove_profile_button.disabled = true;
    remove_profile_button.style.visibility = "hidden";
    remove_profile_button.style.opacity = 0;
}

//attach input listeners to the profile input fields
//when the user starts typing, change the button text to "Save Changes" and hide the add and remove profile buttons
function attachInputListeners() 
{
    const inputs = document.querySelectorAll('.profile_input');
    inputs.forEach(input => 
        {
        input.addEventListener('input', () => {
            markAsChanged("text");
        });
    });
}

function ManageProfiles_OnClick() 
{
    if (isDeleting) 
    {
        isDeleting = false;
        manage_profile_button.innerText = "Go Back";
        renderProfiles('input'); 
        showEditActionButtons(); 
        return;
    }

    if (isEditing && HasChanged) 
    {
        saveProfiles();
    }
    
    isEditing = !isEditing;
    manage_profile_button.innerText = isEditing ? "Go Back" : "Manage Profiles";
    renderProfiles(isEditing ? 'input' : 'div');
    isEditing ? showEditActionButtons() : hideEditActionButtons();
}

async function AddProfile_OnClick() 
{
    if (UI.isUILocked) return;
    const newId = profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) + 1 : 1;
    const newProfile = new Profile(newId, "New Profile_" + newId);
    
    profiles.push(newProfile);
    
    await ClientSessionManager.saveProfiles(profiles);
    
    renderProfiles(isEditing ? 'input' : 'div');
    UI.ShowMessage("הפרופיל נוסף בהצלחה");
}

function RemoveProfile_OnClick() 
{
    if (UI.isUILocked) return;
    if (profiles.length <= 1) 
    {
        UI.ShowErrorMessage("אתה לא יכול למחוק את הפרופיל האחרון");
        return;
    }
    isDeleting = true;
    renderProfiles('div');
    hideEditActionButtons();
    
    manage_profile_button.innerText = "Cancel Deletion";
    
    UI.ShowMessage("לחץ על פרופיל כדי למחוק אותו");
}

//save profiles - save the profiles names to the profiles array after editing
async function saveProfiles()
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

    const response = await ClientSessionManager.saveProfiles(profiles);
    if (!response.success) 
    {
        UI.ShowErrorMessage("שגיאה בשמירת הפרופילים");
        console.error("Error: " + response.message);
    }
    else
    {
        UI.ShowMessage("הפרופילים נשמרו בהצלחה");
        markAsUnchanged();
    }
}


// UI Helper: Converts a pure Profile object into HTML string
function renderProfileComponent(profile, tag_name = 'div') 
{
    if (tag_name === 'input' && (HasChanged == 'text' || !HasChanged)) 
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

function renderProfiles(tag_name = 'div') 
{
    let allProfilesHTML = "";
    profiles.forEach(profile => 
    {
        allProfilesHTML += renderProfileComponent(profile, tag_name);
    });
    
    profiles_area.innerHTML = allProfilesHTML;

    if (UI.isUILocked) 
    {
        profiles_area.style.pointerEvents = "none";
        profiles_area.style.opacity = "0.6";
    }
    else
    {
        profiles_area.style.pointerEvents = "auto";
        profiles_area.style.opacity = "1";
    }

    profiles.forEach(profile => 
    {
        const el = document.getElementById(`profile${profile.id}`);
        if (el) 
        {
            el.addEventListener('click', () => Profile_OnClick(profile));
        }
    });

    attachInputListeners();
}

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
        profiles = profiles.filter(p => p.id !== profile.id);
        await ClientSessionManager.saveProfiles(profiles);
        renderProfiles('div');
        UI.ShowMessage("Profile deleted");
    }
}

async function Profile_OnClick(profile) 
{
    if (UI.isUILocked) return;
    if (isDeleting) 
    {
        confirmAndDeleteProfile(profile);
    }
    else if (isEditing) 
    {
        if(HasChanged === 'image' || !HasChanged)changeProfileImage(profile);
        else
        {
            UI.ShowMessage("אתה נמצא במצב עריכה, נא ללחוץ על כפתור שמירה כדי לשמור על השינויים");
            return;
        }
    }
    else if (!isEditing) 
    {
        const profileNameElement = document.getElementById(`profile_name_${profile.id}`);
        Lock_UI_AND_Profiles(profileNameElement ? profileNameElement : null);
        UI.ShowMessage(`Entering ${profile.name}...`);
        
        const response = await ClientSessionManager.selectProfile(profile.id);
        
        if (response && response.success) 
        {
            setTimeout(() => 
            {
                UI.GoToLink("../html/profile.html");
            }, 2000);
        }
        else 
        {
            UI.ShowErrorMessage("שגיאה בבחירת הפרופיל, נסה שנית.");
            Unlock_UI_AND_Profiles();
        }
        
    }
}


async function Logout_OnClick()
{
    Lock_UI_AND_Profiles(logout_button);
    const response = await ClientSessionManager.logout();
    if (response && response.success)
    {
        UI.ShowMessage("התנתקות בוצעה בהצלחה , מתבצעת העברה...");
        setTimeout(() => 
        {
            UI.GoToLink('../html/login_menu.html');
        }, 2000);
    }
    else
    {
        UI.ShowErrorMessage(response.message);
        Unlock_UI_AND_Profiles();
    }
}

function Lock_UI_AND_Profiles(button)
{
    const isInside = profiles_area.contains(button);
    UI.LockUI(button);
    renderProfiles(isEditing ? 'input' : 'div');
    if (isInside) 
    {
        // The render process clears the UI, so we unlock the global state 
        // and re-apply the spinner to the specific element in the new DOM.
        UI.UnlockUI();  
        const lockedElement = document.getElementById(button.id);
        UI.LockUI(lockedElement ? lockedElement : null);
    }
}

function Unlock_UI_AND_Profiles()
{
    UI.UnlockUI();
    renderProfiles(isEditing ? 'input' : 'div');
}

//mark the changes as "none"
function markAsUnchanged()
{
    HasChanged = null;
    manage_profile_button.innerText = "Manage Profiles";
    showEditActionButtons();
}

//mark the changes as "image" or "text"
function markAsChanged(the_changes)
{
    HasChanged = the_changes;
    manage_profile_button.innerText = "Save Changes";
    hideEditActionButtons();
}
//---------------------------- MAIN ----------------------------------------
if (!ClientSessionManager.isLoggedIn())
{
    UI.GoToLink('../html/login_menu.html');
}
logout_button.addEventListener('click', Logout_OnClick);
manage_profile_button.addEventListener('click', ManageProfiles_OnClick);
add_profile_button.addEventListener('click', AddProfile_OnClick);
remove_profile_button.addEventListener('click', RemoveProfile_OnClick);
const userData = await ClientSessionManager.restoreActiveSession();
if (userData && userData.profiles) 
{
    profiles = userData.profiles;
}
renderProfiles();
