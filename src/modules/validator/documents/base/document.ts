export abstract class Document<TSchema> {
  protected normalized = {} as TSchema;
  protected errors = {} as any;
  protected isValid: boolean;

  constructor(protected data: TSchema) {
  }

  abstract normalize(): this;
  abstract validate(): void;
  abstract infer(): Promise<this>;

  async process(): Promise<this> {
    this.normalize();
    this.validate();
    await this.infer();
    return this;
  }

  get() {
    return { data: this.data, errors: this.errors, isValid: this.isValid };
  }
}
