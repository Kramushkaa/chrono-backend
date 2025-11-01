import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateQuery, validateBody, validateParams, commonSchemas } from '../../middleware/validation';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('validateQuery', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.string().transform(val => parseInt(val, 10)),
    });

    it('should pass valid query parameters', () => {
      mockRequest.query = { name: 'John', age: '25' };

      const middleware = validateQuery(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.query).toEqual({ name: 'John', age: 25 });
    });

    it('should reject invalid query parameters', () => {
      mockRequest.query = { name: 'John' }; // Missing age

      const middleware = validateQuery(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Некорректные параметры запроса'),
        })
      );
    });

    it('should handle multiple validation errors', () => {
      mockRequest.query = {}; // Missing both fields

      const middleware = validateQuery(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Некорректные параметры запроса'),
        })
      );
    });

    it('should handle non-ZodError exceptions', () => {
      const faultySchema = {
        parse: () => {
          throw new Error('Unexpected error');
        },
      } as any;

      mockRequest.query = {};

      const middleware = validateQuery(faultySchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ошибка валидации параметров',
        })
      );
    });
  });

  describe('validateBody', () => {
    const testSchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });

    it('should pass valid body parameters', () => {
      mockRequest.body = { email: 'test@example.com', password: 'password123' };

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.body).toEqual({ email: 'test@example.com', password: 'password123' });
    });

    it('should reject invalid body parameters', () => {
      mockRequest.body = { email: 'invalid-email', password: '123' }; // Invalid email and short password

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Некорректные данные'),
        })
      );
    });

    it('should handle missing required fields', () => {
      mockRequest.body = { email: 'test@example.com' }; // Missing password

      const middleware = validateBody(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Некорректные данные'),
        })
      );
    });

    it('should handle non-ZodError exceptions', () => {
      const faultySchema = {
        parse: () => {
          throw new Error('Unexpected error');
        },
      } as any;

      mockRequest.body = {};

      const middleware = validateBody(faultySchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ошибка валидации данных',
        })
      );
    });
  });

  describe('validateParams', () => {
    const testSchema = z.object({
      id: z.string().uuid(),
    });

    it('should pass valid params', () => {
      mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateParams(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    it('should reject invalid params', () => {
      mockRequest.params = { id: 'not-a-uuid' };

      const middleware = validateParams(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Некорректные параметры пути'),
        })
      );
    });

    it('should handle missing params', () => {
      mockRequest.params = {};

      const middleware = validateParams(testSchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Некорректные параметры пути'),
        })
      );
    });

    it('should handle non-ZodError exceptions', () => {
      const faultySchema = {
        parse: () => {
          throw new Error('Unexpected error');
        },
      } as any;

      mockRequest.params = {};

      const middleware = validateParams(faultySchema);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ошибка валидации параметров пути',
        })
      );
    });
  });

  describe('commonSchemas', () => {
    describe('pagination', () => {
      it('should validate valid pagination params', () => {
        const result = commonSchemas.pagination.parse({
          limit: '10',
          offset: '5',
          count: 'true',
        });

        expect(result).toEqual({
          limit: 10,
          offset: 5,
          count: true,
        });
      });

      it('should handle optional pagination params', () => {
        const result = commonSchemas.pagination.parse({});

        expect(result).toEqual({
          limit: undefined,
          offset: undefined,
          count: false,
        });
      });

      it('should reject limit > 1000', () => {
        expect(() => {
          commonSchemas.pagination.parse({ limit: '1001' });
        }).toThrow();
      });

      it('should reject negative offset', () => {
        expect(() => {
          commonSchemas.pagination.parse({ offset: '-1' });
        }).toThrow();
      });

      it('should handle count=false', () => {
        const result = commonSchemas.pagination.parse({ count: 'false' });

        expect(result.count).toBe(false);
      });
    });

    describe('year', () => {
      it('should validate valid year', () => {
        const result = commonSchemas.year.parse(2000);

        expect(result).toBe(2000);
      });

      it('should validate negative year (BC)', () => {
        const result = commonSchemas.year.parse(-500);

        expect(result).toBe(-500);
      });

      it('should reject year < -3000', () => {
        expect(() => {
          commonSchemas.year.parse(-3001);
        }).toThrow('Год не может быть меньше -3000');
      });

      it('should reject year > 2100', () => {
        expect(() => {
          commonSchemas.year.parse(2101);
        }).toThrow('Год не может быть больше 2100');
      });

      it('should reject non-integer year', () => {
        expect(() => {
          commonSchemas.year.parse(2000.5);
        }).toThrow();
      });
    });

    describe('id', () => {
      it('should validate numeric string id', () => {
        const result = commonSchemas.id.parse('123');

        expect(result).toBe('123');
      });

      it('should validate alphanumeric id', () => {
        const result = commonSchemas.id.parse('person-123');

        expect(result).toBe('person-123');
      });

      it('should reject empty id', () => {
        expect(() => {
          commonSchemas.id.parse('');
        }).toThrow();
      });
    });

    describe('numericId', () => {
      it('should validate and transform numeric id', () => {
        const result = commonSchemas.numericId.parse('123');

        expect(result).toBe(123);
      });

      it('should reject non-numeric id', () => {
        expect(() => {
          commonSchemas.numericId.parse('abc');
        }).toThrow();
      });

      it('should reject negative id', () => {
        expect(() => {
          commonSchemas.numericId.parse('-5');
        }).toThrow();
      });
    });

    describe('register', () => {
      it('should validate valid registration data', () => {
        const result = commonSchemas.register.parse({
          email: 'test@example.com',
          password: 'password123',
          username: 'testuser',
        });

        expect(result.email).toBe('test@example.com');
        expect(result.password).toBe('password123');
      });

      it('should reject invalid email', () => {
        expect(() => {
          commonSchemas.register.parse({
            email: 'invalid-email',
            password: 'password123',
          });
        }).toThrow('Некорректный email');
      });

      it('should reject short password', () => {
        expect(() => {
          commonSchemas.register.parse({
            email: 'test@example.com',
            password: '1234567', // 7 chars, requires 8
          });
        }).toThrow('Пароль должен содержать минимум 8 символов');
      });
    });

    describe('login', () => {
      it('should validate valid login data', () => {
        const result = commonSchemas.login.parse({
          login: 'test@example.com',
          password: 'password',
        });

        expect(result.login).toBe('test@example.com');
        expect(result.password).toBe('password');
      });

      it('should reject empty login', () => {
        expect(() => {
          commonSchemas.login.parse({
            login: '',
            password: 'password',
          });
        }).toThrow();
      });

      it('should reject empty password', () => {
        expect(() => {
          commonSchemas.login.parse({
            login: 'test@example.com',
            password: '',
          });
        }).toThrow();
      });
    });

    describe('changePassword', () => {
      it('should validate valid password change data', () => {
        const result = commonSchemas.changePassword.parse({
          current_password: 'oldpass123',
          new_password: 'newpass1234',
        });

        expect(result.current_password).toBe('oldpass123');
        expect(result.new_password).toBe('newpass1234');
      });

      it('should reject short new password', () => {
        expect(() => {
          commonSchemas.changePassword.parse({
            current_password: 'oldpass123',
            new_password: 'short',
          });
        }).toThrow();
      });
    });

    describe('personSearch', () => {
      it('should validate search params', () => {
        const result = commonSchemas.personSearch.parse({
          q: 'Einstein',
          category: 'Science',
          country: 'Germany',
        });

        expect(result.q).toBe('Einstein');
        expect(result.category).toBe('Science');
      });

      it('should allow empty search params', () => {
        const result = commonSchemas.personSearch.parse({});

        expect(result).toEqual({});
      });
    });
  });
});

