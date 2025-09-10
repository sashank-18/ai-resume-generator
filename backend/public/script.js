const apiBase = "https://ai-resume-generator-rw01.onrender.com"; // your backend URL


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


async function generateResume() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const location = document.getElementById("location").value.trim();
  const summary = document.getElementById("summary").value.trim() || "";
  const skills = document.getElementById("skills").value.trim() || "";


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


async function enhanceText(id) {
  const textarea = document.getElementById(id);
  const text = textarea.value.trim();

  if (!text) {
    alert("Please enter some text to enhance!");
    return;
  }


  const originalValue = textarea.value;
  textarea.value = "Enhancing text... ⏳";

  try {
    const formData = new FormData();
    formData.append("text", text);
    formData.append("purpose", "resume");

    const res = await fetch(`${apiBase}/enhance`, {
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
      throw new Error(errData.error || "Enhancement failed");
    }

    const data = await res.json();

 
    textarea.value = data.improved || originalValue;

  } catch (err) {
    alert("AI enhancement failed: " + err.message);
    textarea.value = originalValue;
    console.error(err);
  }
}



async function analyzeResume() {
  const fileInput = document.getElementById("resumeFile");
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


    document.getElementById("name").value = data.name || "";
    document.getElementById("email").value = data.email || "";
    document.getElementById("phone").value = data.phone || "";
    document.getElementById("location").value = data.location || "";


    if (data.summary) {
      const enhancedSummary = await enhanceTextRemote(data.summary);
      document.getElementById("summary").value = enhancedSummary;
    }

    function autoResizeTextarea(id) {
  const textarea = document.getElementById(id);
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

document.getElementById("summary").value = enhancedSummary;
autoResizeTextarea("summary");


    if (Array.isArray(data.skills)) {
      const skillsArray = data.skills.map(s => (typeof s === "string" ? s : s.name || "")).filter(Boolean);
      document.getElementById("skills").value = skillsArray.join(", ");
    }


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


async function enhanceTextRemote(text) {
  try {
    const formData = new FormData();
    formData.append("text", text);
    formData.append("purpose", "resume");

    const res = await fetch(`${apiBase}/enhance`, { method: "POST", body: formData });
    if (!res.ok) return text; 

    const data = await res.json();
    return data.improved || text;
  } catch {
    return text; 
  }
}
