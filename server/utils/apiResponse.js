export const sendApiSuccess = (res, statusCode, data) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

export const sendApiError = (res, statusCode, code, message, details = null) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };
  if (details !== null && details !== undefined) {
    payload.error.details = details;
  }
  return res.status(statusCode).json(payload);
};
