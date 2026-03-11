const appContext = {
  services: {},
  session: {
    profile: null,
    auth: null,
  },
};

export function setAppServices(services) {
  appContext.services = services;
}

export function getAppServices() {
  return appContext.services;
}

export function setSessionProfile(profile) {
  appContext.session.profile = profile;
}

export function patchSessionProfile(patch) {
  appContext.session.profile = {
    ...(appContext.session.profile ?? {}),
    ...patch,
  };

  return appContext.session.profile;
}

export function getSessionProfile() {
  return appContext.session.profile;
}

export function setAuthSession(auth) {
  appContext.session.auth = auth;
}

export function getAuthSession() {
  return appContext.session.auth;
}