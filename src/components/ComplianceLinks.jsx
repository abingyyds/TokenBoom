import React from 'react';
import { Link } from 'react-router-dom';
import { getSupportEmail } from '../constants/compliance';

export default function ComplianceLinks({ site, linkClassName = '', supportLabel = 'Support' }) {
  const supportEmail = getSupportEmail(site);

  return (
    <>
      <Link to="/terms" className={linkClassName}>Terms of Service</Link>
      <Link to="/privacy" className={linkClassName}>Privacy Policy</Link>
      <a href={`mailto:${supportEmail}`} className={linkClassName}>
        {supportLabel}: {supportEmail}
      </a>
    </>
  );
}
