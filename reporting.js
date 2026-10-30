import { supabase } from './supabase.js';

const REPORT_REASONS = [
  ['harassment', 'Harassment'],
  ['bullying', 'Bullying'],
  ['hate_speech', 'Hate speech'],
  ['violence', 'Violence'],
  ['nudity', 'Nudity or sexual content'],
  ['spam', 'Spam'],
  ['scam', 'Scam or fraud'],
  ['impersonation', 'Impersonation'],
  ['copyright', 'Copyright violation'],
  ['self_harm', 'Self-harm content'],
  ['other', 'Other']
];

const REPORT_STYLES = `
.campusora-report-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  backdrop-filter: blur(7px);
}

.campusora-report-box {
  width: 100%;
  max-width: 430px;
  background: #101629;
  border: 1px solid #293653;
  border-radius: 18px;
  padding: 22px;
  color: #eef3ff;
  font-family: 'DM Sans', sans-serif;
  box-shadow: 0 20px 70px rgba(0,0,0,.5);
}

.campusora-report-box h2 {
  font-size: 19px;
  margin: 0 0 7px;
}

.campusora-report-box p {
  color: #9ba9c3;
  font-size: 12px;
  line-height: 1.6;
  margin: 0 0 18px;
}

.campusora-report-box label {
  display: block;
  font-size: 12px;
  margin: 13px 0 7px;
  color: #dce6ff;
}

.campusora-report-box select,
.campusora-report-box textarea {
  width: 100%;
  box-sizing: border-box;
  background: #080e1d;
  color: white;
  border: 1px solid #2c3a59;
  border-radius: 10px;
  padding: 12px;
  font: inherit;
  font-size: 13px;
  outline: none;
}

.campusora-report-box textarea {
  min-height: 95px;
  resize: vertical;
}

.campusora-report-box select:focus,
.campusora-report-box textarea:focus {
  border-color: #8b5cf6;
}

.campusora-report-buttons {
  display: flex;
  gap: 10px;
  margin-top: 17px;
}

.campusora-report-buttons button {
  flex: 1;
  padding: 12px;
  border: 0;
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.campusora-report-cancel {
  background: #202b43;
  color: white;
}

.campusora-report-submit {
  background: linear-gradient(110deg,#7954ff,#258ce9);
  color: white;
}

.campusora-report-submit:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.campusora-report-status {
  font-size: 12px;
  margin-top: 12px;
  line-height: 1.5;
}

.campusora-report-button {
  border: 0;
  background: transparent;
  color: #aab8d2;
  padding: 7px 10px;
  font-size: 12px;
  cursor: pointer;
}

.campusora-report-button:hover {
  color: #ff7777;
}
`;

let modalCreated = false;

function addStyles() {
  if (document.getElementById('campusora-report-styles')) return;

  const style = document.createElement('style');
  style.id = 'campusora-report-styles';
  style.textContent = REPORT_STYLES;
  document.head.appendChild(style);
}

function createModal() {
  if (modalCreated) return;

  addStyles();

  const overlay = document.createElement('div');
  overlay.className = 'campusora-report-overlay';
  overlay.id = 'campusoraReportOverlay';
  overlay.style.display = 'none';

  overlay.innerHTML = `
    <div class="campusora-report-box" role="dialog"
         aria-modal="true" aria-labelledby="campusoraReportTitle">

      <h2 id="campusoraReportTitle">Report content</h2>

      <p>
        Help keep Campusora safe. Select the reason that best
        describes the problem. Your report will be reviewed.
      </p>

      <form id="campusoraReportForm">

        <label for="campusoraReportReason">
          Why are you reporting this?
        </label>

        <select id="campusoraReportReason" required>
          <option value="">Select a reason</option>
          ${REPORT_REASONS.map(([value, label]) =>
            `<option value="${value}">${label}</option>`
          ).join('')}
        </select>

        <label for="campusoraReportDetails">
          Additional details (optional)
        </label>

        <textarea
          id="campusoraReportDetails"
          maxlength="1000"
          placeholder="Tell us more about the problem..."
        ></textarea>

        <div class="campusora-report-status"
             id="campusoraReportStatus"
             role="status"></div>

        <div class="campusora-report-buttons">
          <button type="button"
                  class="campusora-report-cancel"
                  id="campusoraReportCancel">
            Cancel
          </button>

          <button type="submit"
                  class="campusora-report-submit"
                  id="campusoraReportSubmit">
            Submit report
          </button>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeReport();
  });

  document.getElementById('campusoraReportCancel')
    .addEventListener('click', closeReport);

  document.getElementById('campusoraReportForm')
    .addEventListener('submit', submitReport);

  modalCreated = true;
}

let selectedTarget = null;

export function openReport(contentType, contentId) {
  if (!['user', 'post', 'comment', 'spotlight'].includes(contentType)) {
    console.error('Invalid report content type.');
    return;
  }

  if (!contentId) {
    alert('Could not identify the content to report.');
    return;
  }

  createModal();

  selectedTarget = {
    contentType,
    contentId
  };

  document.getElementById('campusoraReportReason').value = '';
  document.getElementById('campusoraReportDetails').value = '';

  const status = document.getElementById('campusoraReportStatus');
  status.textContent = '';
  status.style.color = '#9ba9c3';

  document.getElementById('campusoraReportOverlay').style.display = 'flex';
}

function closeReport() {
  const overlay = document.getElementById('campusoraReportOverlay');

  if (overlay) overlay.style.display = 'none';

  selectedTarget = null;
}

async function submitReport(event) {
  event.preventDefault();

  if (!selectedTarget) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    alert('Please log in to submit a report.');
    window.location.href = './auth.html?mode=login';
    return;
  }

  const reason = document.getElementById('campusoraReportReason').value;
  const details = document.getElementById('campusoraReportDetails').value.trim();

  const button = document.getElementById('campusoraReportSubmit');
  const status = document.getElementById('campusoraReportStatus');

  if (!reason) {
    status.textContent = 'Please select a reason.';
    status.style.color = '#ff8585';
    return;
  }

  button.disabled = true;
  button.textContent = 'Submitting...';

  status.textContent = 'Sending your report...';
  status.style.color = '#9ba9c3';

  try {
    const { error } = await supabase.rpc('submit_content_report', {
      p_content_type: selectedTarget.contentType,
      p_content_id: selectedTarget.contentId,
      p_reason: reason,
      p_details: details || null
    });

    if (error) throw error;

    status.textContent = 'Your report has been submitted successfully.';
    status.style.color = '#4ade80';

    button.textContent = 'Submitted';

    setTimeout(closeReport, 1400);

  } catch (error) {
    console.error('Report submission error:', error);

    status.textContent =
      error.message || 'Could not submit your report. Please try again.';

    status.style.color = '#ff8585';

    button.disabled = false;
    button.textContent = 'Submit report';
  }
}

export function createReportButton(contentType, contentId) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'campusora-report-button';
  button.textContent = '⚑ Report';

  button.addEventListener('click', () => {
    openReport(contentType, contentId);
  });

  return button;
}
