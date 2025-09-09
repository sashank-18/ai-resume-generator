const apiBase = "https://ai-resume-generator-rw01.onrender.com"; // your backend URL

document.getElementById("generateBtn").addEventListener("click", generateResume);
document.getElementById("addExperienceBtn").addEventListener("click", addExperience);
document.getElementById("addEducationBtn").addEventListener("click", addEducation);
document.getElementById("enhanceSummaryBtn").addEventListener("click", () => enhanceText("summary"));
document.getElementById("analyzeBtn").addEventListener("click", analyzeResume);

async function generateResume() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const location = document.getElementById("location").value;
  const summary = document.getElementById("summary").value;
  const skills = document.getElementById("skills").value;

  const education = [];
  document.querySelectorAll("#educationContainer fieldset").forEach(f => {
    education.push({
      degree: f.querySelector(".eduDegree").value,
      institution: f.querySelector(".eduInstitution").value,
      year: f.querySelector(".eduYear").value
    });
  });

  const experience = [];
  document.querySelectorAll("#experienceContainer fieldset").forEach(f => {
    experience.push({
      title: f.querySelector(".expTitle").value,
      company: f.querySelector(".expCompany").value,
      duration: f.querySelector(".expDuration").value,
      description: f.querySelector(".expDescription").value
    });
  });

  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("phone", phone);
  formData.append("location", location);
  formData.append("summary", summary);
  formData.append("skills", skills);
  formData.append("education_json", JSON.stringify(education));
  formData.append("experience_json", JSON.stringify(experience));

  const res = await fetch(`${apiBase}/generate`, { method: "POST", body: formData });
  if (res.ok) {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}_resume.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    const data = await res.json();
    alert("Resume generation failed: " + JSON.stringify(data));
  }
}

// Placeholder functions (you can fill these in later)
function addExperience() {
  const container = document.getElementById("experienceContainer");
  const fieldset = document.createElement("fieldset");
  fieldset.innerHTML = `
    <legend>Experience</legend>
    <input type="text" class="expTitle" placeholder="Job Title">
    <input type="text" class="expCompany" placeholder="Company">
    <input type="text" class="expDuration" placeholder="Duration">
    <textarea class="expDescription" placeholder="Description"></textarea>
  `;
  container.appendChild(fieldset);
}

function addEducation() {
  const container = document.getElementById("educationContainer");
  const fieldset = document.createElement("fieldset");
  fieldset.innerHTML = `
    <legend>Education</legend>
    <input type="text" class="eduDegree" placeholder="Degree">
    <input type="text" class="eduInstitution" placeholder="Institution">
    <input type="text" class="eduYear" placeholder="Year">
  `;
  container.appendChild(fieldset);
}

function enhanceText(id) {
  const textarea = document.getElementById(id);
  textarea.value = textarea.value + " (Enhanced by AI 🚀)";
}

async function analyzeResume() {
  const fileInput = document.getElementById("resumeFile"); // <input type="file" id="resumeFile">
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select a resume file first!");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    document.getElementById("uploadStatus").innerText = "Analyzing resume... ⏳";

    const res = await fetch(`${apiBase}/analyze`, { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Analysis failed");
    }

    const data = await res.json();

    // ✅ Autofill extracted data into the form
    if (data.name) document.getElementById("name").value = data.name;
    if (data.email) document.getElementById("email").value = data.email;
    if (data.phone) document.getElementById("phone").value = data.phone;
    if (data.location) document.getElementById("location").value = data.location;
    if (data.summary) document.getElementById("summary").value = data.summary;
    if (data.skills) document.getElementById("skills").value = data.skills.join(", ");

    // Education
    if (Array.isArray(data.education)) {
      const container = document.getElementById("educationContainer");
      container.innerHTML = "";
      data.education.forEach(edu => {
        const fieldset = document.createElement("fieldset");
        fieldset.innerHTML = `
          <legend>Education</legend>
          <input type="text" class="eduDegree" value="${edu.degree || ""}" placeholder="Degree">
          <input type="text" class="eduInstitution" value="${edu.institution || ""}" placeholder="Institution">
          <input type="text" class="eduYear" value="${edu.year || ""}" placeholder="Year">
        `;
        container.appendChild(fieldset);
      });
    }

    // Experience
    if (Array.isArray(data.experience)) {
      const container = document.getElementById("experienceContainer");
      container.innerHTML = "";
      data.experience.forEach(exp => {
        const fieldset = document.createElement("fieldset");
        fieldset.innerHTML = `
          <legend>Experience</legend>
          <input type="text" class="expTitle" value="${exp.title || ""}" placeholder="Job Title">
          <input type="text" class="expCompany" value="${exp.company || ""}" placeholder="Company">
          <input type="text" class="expDuration" value="${exp.duration || ""}" placeholder="Duration">
          <textarea class="expDescription" placeholder="Description">${exp.description || ""}</textarea>
        `;
        container.appendChild(fieldset);
      });
    }

    document.getElementById("uploadStatus").innerText = "Resume analysis completed ✅";
  } catch (err) {
    document.getElementById("uploadStatus").innerText = "❌ " + err.message;
  }
}
