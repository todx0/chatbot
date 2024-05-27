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
  public static handleError(error: Error, throwError: boolean = false): string {
    let errorMessage = '';

    if (error instanceof CustomError) {
      errorMessage = `Custom error occurred: ${error.message}`;
      if (error.details) {
        errorMessage += `\nError details: ${JSON.stringify(error.details)}`;
      }
    } else {
      errorMessage = `Unexpected error: ${error.message}`;
    }

    if (throwError) {
      throw error;
    }

    return errorMessage;
  }
}
