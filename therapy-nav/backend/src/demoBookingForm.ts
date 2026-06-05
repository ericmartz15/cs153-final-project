export const DEMO_BOOKING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Book an Appointment — TherapyNav Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f7f5; color: #1a1a1a; padding: 40px 20px; }
    .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
    .logo-icon { width: 36px; height: 36px; background: #5c835c; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 13px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 14px; }
    .field { margin-bottom: 16px; }
    label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #333; }
    input, select, textarea {
      width: 100%; padding: 10px 14px; border: 1.5px solid #e0e0e0; border-radius: 8px;
      font-size: 14px; outline: none; transition: border-color 0.15s;
    }
    input:focus, select:focus, textarea:focus { border-color: #5c835c; }
    textarea { resize: vertical; min-height: 80px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .divider { border: none; border-top: 1.5px solid #f0f0f0; margin: 28px 0; }
    .sensitive-section { background: #fff8f0; border: 1.5px solid #f5d0a0; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
    .sensitive-label { font-size: 12px; color: #b45a00; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
    .btn { width: 100%; padding: 14px; background: #5c835c; color: white; font-size: 15px; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; margin-top: 8px; }
    .btn:hover { background: #4a6b4a; }
    .notice { font-size: 12px; color: #999; text-align: center; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">TN</div>
      <span style="font-weight:600;font-size:16px">TherapyNav Demo Booking</span>
    </div>

    <h1>Schedule an Appointment</h1>
    <p class="subtitle">Booking with <strong>Dr. Sarah Mitchell, LCSW</strong> — Palo Alto, CA</p>

    <form action="#" method="post">
      <div class="section">
        <div class="section-title">Contact Information</div>
        <div class="row">
          <div class="field">
            <label for="first_name">First Name</label>
            <input type="text" id="first_name" name="first_name" placeholder="Alex" />
          </div>
          <div class="field">
            <label for="last_name">Last Name</label>
            <input type="text" id="last_name" name="last_name" placeholder="Smith" />
          </div>
        </div>
        <div class="field">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="you@email.com" />
        </div>
        <div class="field">
          <label for="phone">Phone Number (optional)</label>
          <input type="tel" id="phone" name="phone" placeholder="(650) 555-0100" />
        </div>
      </div>

      <div class="section">
        <div class="section-title">Appointment Preferences</div>
        <div class="field">
          <label for="appointment_type">Appointment Type</label>
          <select id="appointment_type" name="appointment_type">
            <option value="">Select type…</option>
            <option value="initial">Initial Consultation (50 min)</option>
            <option value="followup">Follow-up Session (50 min)</option>
            <option value="telehealth">Telehealth Session</option>
          </select>
        </div>
        <div class="row">
          <div class="field">
            <label for="preferred_day">Preferred Day</label>
            <select id="preferred_day" name="preferred_day">
              <option value="">Any day</option>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
            </select>
          </div>
          <div class="field">
            <label for="preferred_time">Preferred Time</label>
            <select id="preferred_time" name="preferred_time">
              <option value="">Any time</option>
              <option value="morning">Morning (9am–12pm)</option>
              <option value="afternoon">Afternoon (12–5pm)</option>
              <option value="evening">Evening (5–8pm)</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="reason">Reason for Visit</label>
          <textarea id="reason" name="reason" placeholder="Briefly describe what you're hoping to work on…"></textarea>
        </div>
      </div>

      <hr class="divider" />

      <div class="sensitive-section">
        <div class="sensitive-label">⚠ Verification Required</div>
        <div class="field">
          <label for="date_of_birth">Date of Birth</label>
          <input type="date" id="date_of_birth" name="date_of_birth" />
        </div>
        <div class="field">
          <label for="insurance_id">Insurance Member ID</label>
          <input type="text" id="insurance_id" name="insurance_id" placeholder="e.g. W123456789" />
        </div>
      </div>

      <button type="submit" class="btn">Confirm Appointment Request</button>
      <p class="notice">Your information is encrypted and never stored by TherapyNav.</p>
    </form>
  </div>
</body>
</html>`;
