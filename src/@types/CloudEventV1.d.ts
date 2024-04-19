/**
 * **CloudEventV1** is a CloudEvent version 1.0 data structure.
 *
 * Little ES follows this standard specification to keep interoperability with other systems.
 */
export type CloudEventV1 = {
    readonly specversion: string;
    readonly time: string;
    readonly datacontenttype: "json";
    readonly subject: string;
};
