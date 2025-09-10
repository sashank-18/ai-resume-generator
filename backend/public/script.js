const apiBase = "https://ai-resume-generator-rw01.onrender.com"; // your backend URL

// ✅ Button event listeners with preventDefault
document.getElementById("generateBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await generateResume();
});

document.getElementById("addExperienceBtn").addEventListener("click", (e) => {
  e.preventDefault();
  addExperience();
});

document.getElementById("addEducationBtn").addEventListener("click", (e) => {
  e.preventDefault();
  addEducation();
});

document.getElementById("enhanceSummaryBtn").addEventListener("click", (e) => {
  e.preventDefault();
  enhanceText("summary");
});

document.getElementById("analyzeBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await analyzeResume();
});

// --- Generate Resume ---
async function generateResume() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const location = document.getElementById("location").value.trim();
  const summary = document.getElementById("summary").value.trim() || "";
  const skills = document.getElementById("skills").value.trim() || "";

  // ✅ Validate required fields
  if (!name || !email || !phone || !location) {
    alert("Please fill in all required fields: Name, Email, Phone, Location.");
    return;
  }

  const education = Array.from(document.querySelectorAll("#educationContainer fieldset")).map(f => ({
    degree: f.querySelector(".eduDegree")?.value || "",
    institution: f.querySelector(".eduInstitution")?.value || "",
    year: f.querySelector(".eduYear")?.value || ""
  }));

  const experience = Array.from(document.querySelectorAll("#experienceContainer fieldset")).map(f => ({
    title: f.querySelector(".expTitle")?.value || "",
    company: f.querySelector(".expCompany")?.value || "",
    duration: f.querySelector(".expDuration")?.value || "",
    description: f.querySelector(".expDescription")?.value || ""
  }));

  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("phone", phone);
  formData.append("location", location);
  formData.append("summary", summary);
  formData.append("skills", skills);
  formData.append("education_json", JSON.stringify(education));
  formData.append("experience_json", JSON.stringify(experience));

  try {
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
      let data;
      try {
        data = await res.json();
      } catch {
        data = { error: "Server returned non-JSON response" };
      }
      alert("Resume generation failed: " + JSON.stringify(data));
      console.error("Server response:", data);
    }
  } catch (err) {
    alert("Network or server error: " + err.message);
    console.error(err);
  }
}


// --- Add Experience ---
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

// --- Add Education ---
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

// --- Enhance Summary ---
function enhanceText(id) {
  const textarea = document.getElementById(id);
  textarea.value = textarea.value + " (Enhanced by AI 🚀)";
}

// --- Analyze Resume ---
async function analyzeResume() {
  const fileInput = document.getElementById("resumeFile");
  const file = fileInput.files[0];

  // ✅ Validate file
  if (!file) {
    alert("Please select a resume file first!");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    document.getElementById("uploadStatus").innerText = "Analyzing resume... ⏳";

    const res = await fetch(`${apiBase}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let errData;
      try {
        errData = await res.json();
      } catch {
        errData = { error: "Server returned non-JSON response" };
      }
      throw new Error(errData.detail || errData.error || "Analysis failed");
    }

    const data = await res.json();

    // ✅ Autofill profile details safely
    document.getElementById("name").value = data.name || "";
    document.getElementById("email").value = data.email || "";
    document.getElementById("phone").value = data.phone || "";
    document.getElementById("location").value = data.location || "";
    document.getElementById("summary").value = data.summary || "";

    // Skills
    if (Array.isArray(data.skills)) {
      const skillsArray = data.skills.map(skill => {
        if (typeof skill === "string") return skill;
        if (typeof skill === "object" && skill.name) return skill.name;
        return "";
      }).filter(Boolean);
      document.getElementById("skills").value = skillsArray.join(", ");
    }

    // Education
    const containerEdu = document.getElementById("educationContainer");
    containerEdu.innerHTML = "";
    if (Array.isArray(data.education)) {
      data.education.forEach(edu => {
        const f = document.createElement("fieldset");
        f.innerHTML = `
          <legend>Education</legend>
          <input type="text" class="eduDegree" value="${edu.degree || ""}" placeholder="Degree">
          <input type="text" class="eduInstitution" value="${edu.institution || ""}" placeholder="Institution">
          <input type="text" class="eduYear" value="${edu.year || ""}" placeholder="Year">
        `;
        containerEdu.appendChild(f);
      });
    }

    // Experience
    const containerExp = document.getElementById("experienceContainer");
    containerExp.innerHTML = "";
    if (Array.isArray(data.experience)) {
      data.experience.forEach(exp => {
        const f = document.createElement("fieldset");
        f.innerHTML = `
          <legend>Experience</legend>
          <input type="text" class="expTitle" value="${exp.title || ""}" placeholder="Job Title">
          <input type="text" class="expCompany" value="${exp.company || ""}" placeholder="Company">
          <input type="text" class="expDuration" value="${exp.duration || ""}" placeholder="Duration">
          <textarea class="expDescription" placeholder="Description">${exp.description || ""}</textarea>
        `;
        containerExp.appendChild(f);
      });
    }

    document.getElementById("uploadStatus").innerText = "Resume analysis completed ✅";
  } catch (err) {
    document.getElementById("uploadStatus").innerText = "❌ " + err.message;
    console.error(err);
  }
}
