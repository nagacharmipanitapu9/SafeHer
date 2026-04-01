// WELCOME + LOCATION PERMISSION
window.onload = function() {

  addBotMessage("Hi! I can help with safety tips, self-defense, or find nearby police stations and hospitals.");

  setTimeout(() => {
    addBotMessage("📍 We need your location to show nearby emergency services.");

    navigator.geolocation.getCurrentPosition(
      function() {
        addBotMessage("✅ Location access granted! You can now search for police or hospitals.");
      },
      function() {
        addBotMessage("⚠️ Location access denied. Please enable it to use emergency features.");
      }
    );

  }, 1000);
};

// ENTER KEY
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("userInput").addEventListener("keypress", function(e) {
    if(e.key === "Enter") chatbot();
  });
});

// QUICK BUTTONS
function quickMsg(text) {
  document.getElementById("userInput").value = text;
  chatbot();
}

// MESSAGE FUNCTIONS
function addUserMessage(text) {
  let msg = document.createElement("div");
  msg.className = "message user";
  msg.innerText = text;
  document.getElementById("messages").appendChild(msg);
}

function addBotMessage(text) {
  let msg = document.createElement("div");
  msg.className = "message bot";
  msg.innerHTML = text;
  document.getElementById("messages").appendChild(msg);
  document.getElementById("messages").scrollTop = messages.scrollHeight;
}

// CHATBOT LOGIC
function chatbot() {
  let inputField = document.getElementById("userInput");
  let input = inputField.value.toLowerCase();

  if(input === "") return;

  addUserMessage(input);

  // LOCATION FEATURES
  if(input.includes("Police")) {
    getLocation("police station");
    inputField.value = "";
    return;
  }

  if(input.includes("Hospital")) {
    getLocation("hospital");
    inputField.value = "";
    return;
  }

  let response = "";

  if(input.includes("Follow")) {
    response = "Go to a crowded place immediately. Call someone and avoid isolated areas.";
  }
  else if(input.includes("Self Defense") || input.includes("Defend")) {
    response = "Target eyes, nose, and knees. Focus on escaping safely.";
  }
  else if(input.includes("attack")) {
    response = "Shout loudly, attract attention, and run to a safe place.";
  }
  else if(input.includes("alone") || input.includes("night")) {
    response = "Stay in well-lit areas and share your location with someone you trust.";
  }
  else if(input.includes("scared") || input.includes("panic")) {
    response = "Take deep breaths. Stay calm and move to a safe place.";
  }
  else if(input.includes("legal")) {
    response = "You have the right to file an FIR at any police station. Emergency helpline: 112.";
  }
  else {
    response = "I can help with safety tips, legal guidance, or finding nearby emergency services.";
  }

  addBotMessage(response);
  inputField.value = "";
}

// LOCATION FUNCTION
function getLocation(place) {

  addBotMessage("📍 Fetching your location...");

  navigator.permissions.query({ name: 'geolocation' }).then(function(result) {

    if (result.state === 'denied') {
      addBotMessage("⚠️ Location access is blocked. Please enable it to find nearby " + place + "s.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(pos) {

        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;

        let link = "https://www.google.com/maps/search/" + place + "/@" + lat + "," + lon + ",15z";

        addBotMessage(`
          Here are nearby ${place}s 👇<br>
          <a href="${link}" target="_blank" style="
            display:inline-block;
            margin-top:8px;
            padding:8px 12px;
            background:#5a67d8;
            color:white;
            border-radius:8px;
            text-decoration:none;">
            Open in Maps
          </a>
        `);
      },
      function() {
        addBotMessage("📍 Please allow location access to get nearby " + place + "s.");
      }
    );

  });

}
function faqMsg(question){

    const messages = document.getElementById("messages");

    // show user question
    messages.innerHTML += `<div class="message user">${question}</div>`;

    let answer = "";

    if(question === "📞 What is the emergency number?"){
        answer = "📞 Emergency numbers in India: Police 100, Ambulance 102, Women Helpline 1091.";
    }

    else if(question === "📍 How can I share my live location?"){
        answer = "You can share your live location using Google Maps or WhatsApp Live Location to our friends and family.";
    }

    else if(question === "⚠️ What should I do if I feel unsafe?"){
        answer = "First, move to a crowded place, call a trusted person, or contact the police immediately. Stay safe and be aware of your surroundings.";
    }

    else if(question === "🌙 What are some late night safety tips?"){
        answer = "Avoid isolated areas, keep emergency contacts ready, and share your travel details before leaving.";
    }

    else if(question === "🚨 How can I report a crime?"){
        answer = "You can report crimes at the nearest police station or through the National Cyber Crime portal or by the report crime in SafeHer platform.";
    }

    else if(question === "🚌 What are some safe travel tips?"){
        answer = "Use trusted transport services and always share your ride details with someone.";
    }

    // bot reply
    messages.innerHTML += `<div class="message bot">${answer}</div>`;

    // scroll to latest message
    messages.scrollTop = messages.scrollHeight;

    // scroll page to chatbot
    document.querySelector(".chat-container").scrollIntoView({
        behavior: "smooth"
    });
}