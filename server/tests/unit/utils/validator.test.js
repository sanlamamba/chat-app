import validator from "../../../src/utils/validator.js";

describe("Validator", () => {
  describe("validateUsername", () => {
    test("accepts valid usernames", () => {
      const validUsernames = ["user123", "test_user", "chat-user", "alice"];

      validUsernames.forEach((username) => {
        const result = validator.validateUsername(username);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test("rejects invalid usernames", () => {
      const invalidCases = [
        { input: "", expectedError: "Username is required" },
        { input: null, expectedError: "Username is required" },
        { input: "a", expectedError: "Username must be at least 2 characters" },
        {
          input: "a".repeat(31),
          expectedError: "Username must be at most 30 characters",
        },
        {
          input: "user@name",
          expectedError:
            "Username can only contain letters, numbers, underscores, and hyphens",
        },
        {
          input: "user space",
          expectedError:
            "Username can only contain letters, numbers, underscores, and hyphens",
        },
      ];

      invalidCases.forEach(({ input, expectedError }) => {
        const result = validator.validateUsername(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(expectedError);
      });
    });
  });

  describe("validateRoomName", () => {
    test("accepts valid room names", () => {
      const validRoomNames = [
        "general",
        "gaming chat",
        "test_room",
        "room-123",
      ];

      validRoomNames.forEach((roomName) => {
        const result = validator.validateRoomName(roomName);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test("rejects invalid room names", () => {
      const invalidCases = [
        { input: "", expectedError: "Room name is required" },
        {
          input: "ab",
          expectedError: "Room name must be at least 3 characters",
        },
        {
          input: "a".repeat(51),
          expectedError: "Room name must be at most 50 characters",
        },
        {
          input: "room@name",
          expectedError: "Room name contains invalid characters",
        },
      ];

      invalidCases.forEach(({ input, expectedError }) => {
        const result = validator.validateRoomName(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(expectedError);
      });
    });
  });

  describe("validateMessage", () => {
    test("accepts valid messages", () => {
      const validMessages = ["Hello world!", "Test message", "A".repeat(100)];

      validMessages.forEach((message) => {
        const result = validator.validateMessage(message);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test("rejects invalid messages", () => {
      const invalidCases = [
        { input: "", expectedError: "Message content is required" },
        { input: "   ", expectedError: "Message cannot be empty" },
        { input: null, expectedError: "Message content is required" },
        {
          input: "A".repeat(4097),
          expectedError: "Message must be at most 4096 characters",
        },
      ];

      invalidCases.forEach(({ input, expectedError }) => {
        const result = validator.validateMessage(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(expectedError);
      });
    });
  });

  describe("sanitizeContent", () => {
    test("removes XSS script tags", () => {
      const scriptInput = '<script>alert("xss")</script>normal text';
      const result = validator.sanitizeContent(scriptInput);
      expect(result.toLowerCase()).not.toContain("script");
      expect(result).toContain("normal text");
    });

    test("removes iframe tags", () => {
      const iframeInput = '<iframe src="malicious.com"></iframe>safe content';
      const result = validator.sanitizeContent(iframeInput);
      expect(result.toLowerCase()).not.toContain("iframe");
      expect(result).toContain("safe content");
    });

    test("escapes HTML entities", () => {
      const input = "test content without dangerous patterns";
      const result = validator.sanitizeContent(input);

      expect(result).toBe("test content without dangerous patterns");
    });

    test("throws error for SQL injection attempts", () => {
      const sqlAttempts = [
        "'; DROP TABLE users; --",
        "UNION SELECT * FROM passwords",
        "1; DELETE FROM messages",
      ];

      sqlAttempts.forEach((attempt) => {
        expect(() => validator.sanitizeContent(attempt)).toThrow(
          "Content contains potentially harmful patterns"
        );
      });
    });

    test("preserves normal text", () => {
      const normalText = "This is a normal message with numbers 123";
      const result = validator.sanitizeContent(normalText);
      expect(result).toContain("This is a normal message");
      expect(result).toContain("123");
    });
  });

  describe("detectSpam", () => {
    test("detects repetitive content", () => {
      const repetitiveMessage = "test test test test test test";
      const result = validator.detectSpam(repetitiveMessage, "user1", []);

      expect(result.triggers.repetition).toBe(true);
    });

    test("detects excessive caps", () => {
      const capsMessage = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const result = validator.detectSpam(capsMessage, "user1", []);

      expect(result.triggers.caps).toBe(true);
    });

    test("detects duplicate messages", () => {
      const message = "Hello world";
      const recentMessages = ["Hello world", "other message"];
      const result = validator.detectSpam(message, "user1", recentMessages);

      expect(result.triggers.duplicates).toBe(true);
    });

    test("detects suspicious links", () => {
      const messageWithSuspiciousLink =
        "Check this out: https://bit.ly/malicious";
      const result = validator.detectSpam(
        messageWithSuspiciousLink,
        "user1",
        []
      );

      expect(result.triggers.links).toBe(true);
    });

    test("flags message as spam when multiple triggers are present", () => {
      const spamMessage =
        "CHECK CHECK CHECK CHECK CHECK CHECK https://bit.ly/spam";
      const result = validator.detectSpam(spamMessage, "user1", []);

      expect(result.isSpam).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    test("does not flag normal messages as spam", () => {
      const normalMessage = "Hello, how are you doing today?";
      const result = validator.detectSpam(normalMessage, "user1", []);

      expect(result.isSpam).toBe(false);
      expect(result.score).toBeLessThan(2);
    });
  });

  describe("command parsing", () => {
    test("identifies valid commands", () => {
      const validCommands = ["/help", "/join", "/create", "/leave"];

      validCommands.forEach((command) => {
        expect(validator.isCommand(command)).toBe(true);
      });
    });

    test("rejects invalid commands", () => {
      const invalidCommands = [
        "help",
        "not a command",
        "/123invalid",
        "/ invalid",
      ];

      invalidCommands.forEach((command) => {
        expect(validator.isCommand(command)).toBe(false);
      });
    });

    test("parses commands correctly", () => {
      const testCases = [
        { input: "/help", expected: { command: "help", args: [] } },
        {
          input: "/join room1",
          expected: { command: "join", args: ["room1"] },
        },
        {
          input: "/create new room",
          expected: { command: "create", args: ["new", "room"] },
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = validator.parseCommand(input);
        expect(result).toEqual(expected);
      });
    });

    test("returns null for invalid commands", () => {
      const invalidCommands = ["help", "not a command", "/123invalid"];

      invalidCommands.forEach((command) => {
        const result = validator.parseCommand(command);
        expect(result).toBeNull();
      });
    });
  });
});
