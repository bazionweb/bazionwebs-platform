import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { SelectField, TextAreaField, TextField } from "./form-fields.js";

function resolveComponents(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function") {
    return resolveComponents((element.type as (props: Record<string, unknown>) => ReactNode)(element.props as Record<string, unknown>));
  }
  const children = Children.toArray(element.props.children).map(resolveComponents);
  if ((element.type as unknown) === Fragment) return children;
  return cloneElement(element, {}, ...children);
}

type TestElement = ReactElement<Record<string, unknown>>;

function childElements(element: ReactElement): TestElement[] {
  const resolved = resolveComponents(element) as TestElement;
  return Children.toArray(resolved.props.children as ReactNode).filter(isValidElement) as TestElement[];
}

function at(elements: TestElement[], index: number): TestElement {
  const element = elements[index];
  if (!element) throw new Error(`Expected child element ${index} to exist`);
  return element;
}

describe("accessible form fields", () => {
  it("associates labels and required state with text controls", () => {
    const field = TextField({ id: "email", label: "Email address", type: "email", required: true });
    const elements = childElements(field);
    const label = at(elements, 0);
    const input = at(elements, 1);

    expect(label.props).toMatchObject({ htmlFor: "email", className: "bw-field-label" });
    expect(input.props).toMatchObject({ id: "email", type: "email", required: true, className: "bw-control" });
    expect(at(childElements(label), 0).props).toMatchObject({ className: "bw-field-required", "aria-hidden": "true" });
  });

  it("connects hints and errors to the field and marks invalid input", () => {
    const field = TextField({ id: "name", label: "Name", hint: "Use your full name.", error: "Name is required." });
    const elements = childElements(field);
    const label = at(elements, 0);
    const input = at(elements, 1);
    const hint = at(elements, 2);
    const error = at(elements, 3);

    expect(input.props).toMatchObject({
      "aria-describedby": "name-hint name-error",
      "aria-invalid": true,
    });
    expect(hint.props).toMatchObject({ id: "name-hint", className: "bw-field-hint" });
    expect(error.props).toMatchObject({ id: "name-error", className: "bw-field-error" });
    expect(label.props.htmlFor).toBe("name");
  });

  it("preserves select options and textarea constraints", () => {
    const options = <option value="general">General</option>;
    const select = SelectField({ id: "category", label: "Category", required: true, children: options });
    const selectControl = at(childElements(select), 1);
    const [optionNode] = Children.toArray(selectControl.props.children as ReactNode).filter(isValidElement);
    const option = optionNode as TestElement | undefined;
    const textarea = TextAreaField({ id: "message", label: "Message", maxLength: 5000, rows: 5 });
    const textareaControl = at(childElements(textarea), 1);

    expect(selectControl.props).toMatchObject({ id: "category", required: true });
    expect(option?.props).toMatchObject({ value: "general", children: "General" });
    expect(textareaControl.props).toMatchObject({ id: "message", maxLength: 5000, rows: 5, className: "bw-control" });
  });
});
