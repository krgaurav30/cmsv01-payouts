const form = document.getElementById("login-form");
const responseBox = document.getElementById("login-response");

const existingSession = localStorage.getItem("cmsCorporateSession");
if (existingSession) {
  window.location.href = "/corporate/operations";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    username: String(formData.get("username")),
    password: String(formData.get("password"))
  };

  responseBox.textContent = "Signing in...";

  try {
    const response = await fetch("/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    responseBox.textContent = JSON.stringify(
      {
        status: response.status,
        data
      },
      null,
      2
    );

    if (response.ok) {
      localStorage.setItem("cmsCorporateSession", JSON.stringify(data.session));
      window.location.href = "/corporate/operations";
    }
  } catch (error) {
    responseBox.textContent = `Request failed:\n${String(error)}`;
  }
});
