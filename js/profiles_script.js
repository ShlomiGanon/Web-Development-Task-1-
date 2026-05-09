
function ManageProfiles_OnClick()
{
    if (isEditing) 
    {
        saveProfiles();
        ShowMessage("Profiles saved successfully");
    }
    isEditing = !isEditing;
    renderProfiles(isEditing ? 'input' : 'div');
    manage_profile_button.innerText = isEditing ? "Finish Editing" : "Manage Profiles";

    add_profile_button.disabled = !isEditing;//prevent the button from being clicked through fade
    add_profile_button.style.visibility = isEditing ? "visible" : "hidden";
    add_profile_button.style.opacity = isEditing ? 1 : 0;
    
    remove_profile_button.disabled = !isEditing;//prevent the button from being clicked through fade
    remove_profile_button.style.visibility = isEditing ? "visible" : "hidden";
    remove_profile_button.style.opacity = isEditing ? 1 : 0;
}
//render profiles - render the profiles to the profiles area
function renderProfiles(tag_name = 'div')
{
    let allProfilesHTML = "";
    profiles.forEach(profile => 
        {
            allProfilesHTML += profile.render(tag_name);
        }
    );
    profiles_area.innerHTML = allProfilesHTML;
}

//save profiles - save the profiles names to the profiles array after editing
function saveProfiles()
{
    profiles.forEach(profile => 
        {
            profile.name = document.getElementById(`profile_input_${profile.id}`).value;
        }
    );
}


//profile class
class Profile 
{
    constructor(id, name, imageName) 
    {
        this.id = id;
        this.name = name;
        this.imageName = imageName;
    }

    render(tag_name = 'div') 
    {
        if (tag_name === 'input') 
            {
            return `
                <div>
                <div class="profile" id="profile${this.id}" style="cursor: pointer;">
                    <div class="profile_image">
                        <img src="../assets/${this.imageName}" alt="${this.name}" class="img-fluid border border-3 border-dark">
                    </div>
                </div>
                    <input id="profile_input_${this.id}" autocomplete="off" type="text" class="profile_input mt-3 text-secondary text-center" value="${this.name}">
                </div>
            `;
        } 
        else 
        {
            return `
                <div class="profile" id="profile${this.id}" style="cursor: pointer;">
                    <div class="profile_image">
                        <img src="../assets/${this.imageName}" alt="${this.name}" class="img-fluid border border-3 border-dark">
                    </div>
                    <div class="profile_name mt-3 text-secondary text-center">
                        ${this.name}
                    </div>
                </div>
            `;
        }
    }
}

//variables
let isEditing = false;
const profiles_area = document.getElementById('profiles');
const manage_profile_button = document.getElementById('manage-profile-button');
const add_profile_button = document.getElementById('add-profile-button');
const remove_profile_button = document.getElementById('remove-profile-button');
//profiles array
const profiles = 
[
    new Profile(1, 'Profile 1', 'profile1.png'),
    new Profile(2, 'Profile 2', 'profile2.png'),
    new Profile(3, 'Profile 3', 'profile3.png'),
    //new Profile(4, 'Profile 4', 'profile4.png'),
    //new Profile(5, 'Profile 5', 'profile5.png')
];


renderProfiles();
manage_profile_button.addEventListener('click', ManageProfiles_OnClick);
add_profile_button.addEventListener('click', AddProfile_OnClick);
remove_profile_button.addEventListener('click', RemoveProfile_OnClick);
