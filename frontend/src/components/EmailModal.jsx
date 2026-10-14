// src/components/EmailModal.jsx
import React, { useState } from "react";
import emailjs from "@emailjs/browser";

const EJS_KEYS = { publicKey:"", serviceId:"", templateId:"", fromName:"TalentLens HR Team" };
let ejsInitialized = false;

export default function EmailModal({ pending, onClose, onSent, showToast }) {
  const [state, setState] = useState("preview"); // preview | sending | success | error
  const [errMsg, setErrMsg] = useState("");
  const [showSetup, setShowSetup] = useState(!ejsInitialized);
  const [keys, setKeys] = useState({ publicKey:EJS_KEYS.publicKey, serviceId:EJS_KEYS.serviceId, templateId:EJS_KEYS.templateId, fromName:EJS_KEYS.fromName });

  if (!pending) return null;
  const { ap, co, subject, body, decision } = pending;
  const isSelected = decision === "shortlisted";

  function saveConfig() {
    if (!keys.publicKey || !keys.serviceId || !keys.templateId) { showToast("⚠ Fill in all 3 EmailJS fields."); return; }
    Object.assign(EJS_KEYS, keys);
    emailjs.init({ publicKey: EJS_KEYS.publicKey });
    ejsInitialized = true;
    setShowSetup(false);
    showToast("✅ EmailJS configured!");
  }

  async function sendEmail() {
    setState("sending");
    const plain = body.replace(/<br>/g,"\n").replace(/<[^>]+>/g,"");
    if (ejsInitialized && EJS_KEYS.serviceId && EJS_KEYS.templateId) {
      try {
        await emailjs.send(EJS_KEYS.serviceId, EJS_KEYS.templateId, { to_email:ap.email, to_name:ap.name, from_name:EJS_KEYS.fromName||`${co.name} HR Team`, subject, message:plain, company:co.name, score:`${ap.overall}%` });
        setState("success");
        setTimeout(() => { onSent(); showToast(`📧 Email delivered to ${ap.name}`); }, 2200);
      } catch(err) {
        setErrMsg(`EmailJS Error: ${err?.text||err?.message||"Unknown"}. Check your Service ID, Template ID, Public Key and template variables.`);
        setState("error");
      }
    } else {
      setTimeout(() => {
        setErrMsg("EmailJS not configured. Set up your keys using the ⚙ Setup panel.");
        setState("error");
        setShowSetup(true);
      }, 800);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-close" onClick={onClose}>✕</div>
        <div className="modal-title">{isSelected ? "✅ Send Selection Email" : "❌ Send Rejection Email"}</div>
        <div className="modal-sub">Preview email to {ap.name} before sending</div>

        {showSetup && (
          <div className="setup-panel">
            <div className="setup-panel-title">⚙ EmailJS Configuration</div>
            <div className="setup-row">
              <input className="setup-input" placeholder="Public Key" value={keys.publicKey} onChange={e=>setKeys(k=>({...k,publicKey:e.target.value}))} />
              <input className="setup-input" placeholder="Service ID (service_xxxx)" value={keys.serviceId} onChange={e=>setKeys(k=>({...k,serviceId:e.target.value}))} />
            </div>
            <div className="setup-row full">
              <input className="setup-input" placeholder="Template ID (template_xxxx)" value={keys.templateId} onChange={e=>setKeys(k=>({...k,templateId:e.target.value}))} />
            </div>
            <div className="setup-row full">
              <input className="setup-input" placeholder="Sender name (e.g. TalentLens HR Team)" value={keys.fromName} onChange={e=>setKeys(k=>({...k,fromName:e.target.value}))} />
            </div>
            <div style={{fontSize:"0.7rem",color:"var(--muted)",margin:"0.3rem 0 0.7rem"}}>
              Get free keys at <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>emailjs.com</a>.
              Template variables: <code style={{color:"#a5b4fc"}}>{"{{to_email}}"}</code> <code style={{color:"#a5b4fc"}}>{"{{to_name}}"}</code> <code style={{color:"#a5b4fc"}}>{"{{subject}}"}</code> <code style={{color:"#a5b4fc"}}>{"{{message}}"}</code>
            </div>
            <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
              <button className="btn-send-mail btn-send-selected" style={{flex:"none",padding:"0.5rem 1.1rem",fontSize:"0.78rem"}} onClick={saveConfig}>Save Config</button>
              <span className="setup-toggle" onClick={() => setShowSetup(false)}>▲ Hide setup</span>
            </div>
          </div>
        )}
        {!showSetup && <span className="setup-toggle" onClick={() => setShowSetup(true)}>⚙ Show email setup</span>}

        {state === "preview" && (
          <>
            <div className="email-field"><div className="email-label">To</div><div className="email-val">{ap.name} &lt;{ap.email}&gt;</div></div>
            <div className="email-field"><div className="email-label">Subject</div><div className="email-val">{subject}</div></div>
            <div className="email-preview" dangerouslySetInnerHTML={{__html: body.replace(/\n/g,"<br/>")}} />
            <div className="modal-actions">
              <button className="btn-cancel-modal" onClick={onClose}>Cancel</button>
              <button className={`btn-send-mail ${isSelected?"btn-send-selected":"btn-send-rejected"}`} onClick={sendEmail}>
                📧 {isSelected ? "Send Selection Email" : "Send Rejection Email"}
              </button>
            </div>
          </>
        )}
        {state === "sending" && (
          <div className="sending-state"><div className="sending-anim">📨</div><div className="sending-txt">Sending email to candidate…</div></div>
        )}
        {state === "success" && (
          <div className="sent-success"><div className="sent-ico">✅</div><div className="sent-msg">Email sent successfully!</div><div style={{fontSize:"0.78rem",color:"var(--muted2)",marginTop:"0.3rem"}}>Delivered to {ap.email}</div></div>
        )}
        {state === "error" && (
          <div className="sent-error">
            <div className="sent-error-msg">⚠ Email could not be sent</div>
            <div className="sent-error-detail">{errMsg}</div>
            <button className="btn-cancel-modal" style={{marginTop:"0.8rem"}} onClick={() => { setState("preview"); }}>← Back to Preview</button>
          </div>
        )}
      </div>
    </div>
  );
}
