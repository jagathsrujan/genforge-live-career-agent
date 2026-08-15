declare module "pdf-parse" {
  const parse: (input: Buffer) => Promise<{ text: string }>;
  export default parse;
}
