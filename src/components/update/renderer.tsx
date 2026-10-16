import { Blocks } from "./blocks";

type UpdateRendererProps = {
  /** The update's stored blocks (Update.content). */
  content: unknown;
};

/** An investor update as its readers see it. */
const UpdateRenderer = ({ content }: UpdateRendererProps) => {
  return <Blocks blocks={content} />;
};

export default UpdateRenderer;
