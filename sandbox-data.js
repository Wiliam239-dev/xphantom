const SandboxDB = (() => {
  let users = [
    { username: "member_demo",  password: "member123", role: "member"    },
    { username: "dev_demo",     password: "dev123",    role: "developer" },
    { username: "siti",         password: "siti999",   role: "member"    },
    { username: "rama",         password: "rama777",   role: "member"    },
  ];

  let tokens = [
    { token: "1234567890:AABBCCDemoTokenXYZ001", owner: "member_demo", added: "2024-03-01" },
    { token: "9876543210:AABBCCDemoTokenXYZ002", owner: "siti",        added: "2024-03-15" },
  ];

  return {
    getUsers:    ()       => JSON.parse(JSON.stringify(users)),
    saveUsers:   (u)      => { users = u; },
    getTokens:   ()       => JSON.parse(JSON.stringify(tokens)),
    saveTokens:  (t)      => { tokens = t; },
  };
})();
