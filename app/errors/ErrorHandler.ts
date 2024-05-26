export class CustomError extends Error {
  public details?: object;

  constructor(messageOrObject: string | { message: string; [key: string]: any }) {
    if (typeof messageOrObject === 'string') {
      super(messageOrObject);
    } else {
      super(messageOrObject.message);
      this.details = { ...messageOrObject };
    }
    this.name = 'CustomError';
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export class ErrorHandler {
  public static handleError(error: Error): void {
    if (error instanceof CustomError) {
      console.error(`Custom error occurred: ${error.message}`);
      if (error.details) {
        console.error(`Error details: ${JSON.stringify(error.details)}`);
      }
    } else {
      console.error(`Unexpected error: ${error.message}`);
    }
  }
}
