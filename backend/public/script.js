const apiBase = "https://ai-resume-generator-rw01.onrender.com"; // change to your backend URL

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
