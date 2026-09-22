/**
 * Parses user-agent strings into friendly browser and device classifications.
 */
export const parseUserAgent = (userAgentString = '') => {
  const ua = String(userAgentString || '');

  // Determine Device Type
  let deviceType = 'Desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera Mini/i.test(ua)) {
    deviceType = 'Mobile';
  }

  // Determine Browser
  let browser = 'Chrome';
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Safari';
  } else if (/Chrome\//i.test(ua)) {
    browser = 'Chrome';
  } else if (ua) {
    browser = 'Browser';
  }

  return { deviceType, browser };
};
