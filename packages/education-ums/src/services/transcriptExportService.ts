import { Student } from "../types";


export interface ExportContext {
  selectedStudent: Student;
  getAcademicRecommendation: () => string;
  fixedRows: any[];
  stats: { current: string; cumulative: string; };
  transcriptType: string;
  securityData: any;
  logo: string;
  selectedTerm: string;
}

export const downloadWord = async (context: ExportContext) => {
  const { selectedStudent, getAcademicRecommendation, fixedRows, stats, transcriptType, securityData, logo, selectedTerm } = context;
  const formatNumber = (n: number, decimals: number = 2) => n.toFixed(decimals);
  const formatSimpleDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  
  // Strip the enclosing function signature and just execute the body

    if (!selectedStudent) return;

    try {
      const {
        Document,
        Paragraph,
        TextRun,
        Table,
        TableRow,
        TableCell,
        AlignmentType,
        
        BorderStyle,
        WidthType,
        convertInchesToTwip,
        ImageRun,
        VerticalAlign,
        ShadingType,
      } = await import('../shims/docx');
      const { saveAs } = await import('../shims/file-saver');

      const fileName =
        `${transcriptType}_TRANSCRIPT_${selectedStudent.id}_${selectedStudent.last_name}`.toUpperCase();

      // Fetch logo as base64
      let logoBase64 = "";
      try {
        const response = await fetch(logo);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.warn("Could not fetch logo:", error);
      }

      // Create table rows for performance records - matching preview layout
      const tableRows = [
        // Header row with gray background
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  text: "Course Code",
                  alignment: AlignmentType.LEFT,
                  style: "TableHeader",
                }),
              ],
              shading: { fill: "F3F4F6", type: ShadingType.SOLID },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              },
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: "Course Description",
                  alignment: AlignmentType.LEFT,
                  style: "TableHeader",
                }),
              ],
              shading: { fill: "F3F4F6", type: ShadingType.SOLID },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              },
              verticalAlign: VerticalAlign.CENTER,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: "Hours",
                  alignment: AlignmentType.CENTER,
                  style: "TableHeader",
                }),
              ],
              shading: { fill: "F3F4F6", type: ShadingType.SOLID },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              },
              verticalAlign: VerticalAlign.CENTER,
              width: { size: 15, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: "Grade",
                  alignment: AlignmentType.CENTER,
                  style: "TableHeader",
                }),
              ],
              shading: { fill: "F3F4F6", type: ShadingType.SOLID },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              },
              verticalAlign: VerticalAlign.CENTER,
              width: { size: 10, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        // Data rows
        ...fixedRows.map(
          (rec) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: rec?.courseCode ?? "",
                          font: "Courier New",
                          bold: true,
                          size: 18,
                          color: "4B0082",
                        }),
                      ],
                      alignment: AlignmentType.LEFT,
                    }),
                  ],
                  borders: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    left: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                    right: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                  },
                  verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: (rec?.courseName ?? "").toUpperCase(),
                          bold: true,
                          size: 18,
                        }),
                      ],
                      alignment: AlignmentType.LEFT,
                    }),
                  ],
                  borders: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    left: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                    right: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                  },
                  verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: rec ? formatNumber(rec.credits, 2) : "",
                          bold: true,
                          size: 18,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  borders: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    left: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                    right: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                  },
                  verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: rec?.grade ?? "",
                          bold: true,
                          size: 22,
                          color: rec
                            ? rec.score >= 70
                              ? "10B981"
                              : rec.score < 40
                                ? "DC2626"
                                : "4B0082"
                            : "4B0082",
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  borders: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "E5E7EB",
                    },
                    left: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                    right: {
                      style: BorderStyle.SINGLE,
                      size: 1,
                      color: "000000",
                    },
                  },
                  verticalAlign: VerticalAlign.CENTER,
                }),
              ],
            }),
        ),
      ];

      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "TableHeader",
              name: "Table Header",
              basedOn: "Normal",
              run: {
                bold: true,
                size: 18,
                font: "Arial",
                color: "000000",
              },
            },
          ],
        },
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: convertInchesToTwip(0.5),
                  right: convertInchesToTwip(0.5),
                  bottom: convertInchesToTwip(0.5),
                  left: convertInchesToTwip(0.5),
                },
              },
            },
            children: [
              // Microtext security line
              new Paragraph({
                text: "BMI UNIVERSITY OFFICIAL ACADEMIC TRANSCRIPT • SECURITY VALIDATED RECORD • DO NOT REPRODUCE",
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                style: "Normal",
                run: {
                  size: 12,
                  color: "999999",
                  font: "Arial",
                },
              }),

              // Header with logo
              ...(logoBase64
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                      children: [
                        new ImageRun({
                          type: "png",
                          data: logoBase64,
                          transformation: {
                            width: 64,
                            height: 64,
                          },
                        }),
                      ],
                    }),
                  ]
                : []),

              // University name
              new Paragraph({
                text: "BMI UNIVERSITY",
                alignment: AlignmentType.CENTER,
                spacing: { after: 50 },
                run: {
                  size: 32,
                  bold: true,
                  font: "Georgia",
                  color: "000000",
                },
              }),

              // Office of the Registrar
              new Paragraph({
                text: "OFFICE OF THE REGISTRAR",
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                run: {
                  size: 14,
                  bold: true,
                  font: "Arial",
                  color: "666666",
                },
              }),

              // Document title with border
              new Paragraph({
                text: `${transcriptType.toUpperCase()} ACADEMIC TRANSCRIPT${transcriptType === "Provisional" ? ` | PERIOD: ${selectedTerm.toUpperCase()}` : ""}`,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: "000000",
                  },
                },
                run: {
                  size: 20,
                  bold: true,
                  font: "Georgia",
                  color: "000000",
                },
              }),

              // Student Name (large, prominent)
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 100 },
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 3,
                    color: "CCCCCC",
                  },
                },
                children: [
                  new TextRun({
                    text: "Student Name:  ",
                    size: 14,
                    bold: true,
                    font: "Arial",
                    color: "999999",
                  }),
                  new TextRun({
                    text: `${selectedStudent.first_name.toUpperCase()} ${selectedStudent.last_name.toUpperCase()}`,
                    size: 24,
                    bold: true,
                    font: "Georgia",
                    color: "000000",
                  }),
                ],
              }),

              // Student details grid (2 columns)
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0 },
                  bottom: { style: BorderStyle.NONE, size: 0 },
                  left: { style: BorderStyle.NONE, size: 0 },
                  right: { style: BorderStyle.NONE, size: 0 },
                  insideHorizontal: { style: BorderStyle.NONE, size: 0 },
                  insideVertical: { style: BorderStyle.NONE, size: 0 },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "Year of study: ",
                                size: 16,
                                color: "666666",
                                font: "Arial",
                              }),
                              new TextRun({
                                text: selectedStudent.year_of_study || "4 (FOUR)",
                                size: 18,
                                bold: true,
                                font: "Arial",
                              }),
                            ],
                          }),
                        ],
                        borders: {
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 1,
                            color: "E5E7EB",
                          },
                        },
                        margins: { bottom: 50 },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "Prog. of Study: ",
                                size: 16,
                                color: "666666",
                                font: "Arial",
                              }),
                              new TextRun({
                                text: (
                                  selectedStudent.program ||
                                  selectedStudent.program_code ||
                                  ""
                                ).toUpperCase(),
                                size: 18,
                                bold: true,
                                font: "Arial",
                              }),
                            ],
                          }),
                        ],
                        borders: {
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 1,
                            color: "E5E7EB",
                          },
                        },
                        margins: { bottom: 50 },
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "FACULTY OF: ",
                                size: 16,
                                color: "666666",
                                font: "Arial",
                              }),
                              new TextRun({
                                text: (
                                  selectedStudent.faculty || "THEOLOGY"
                                ).toUpperCase(),
                                size: 18,
                                bold: true,
                                font: "Arial",
                              }),
                            ],
                          }),
                        ],
                        borders: {
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 1,
                            color: "E5E7EB",
                          },
                        },
                        margins: { bottom: 50 },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "Student ID: ",
                                size: 16,
                                color: "666666",
                                font: "Arial",
                              }),
                              new TextRun({
                                text: selectedStudent.reg_no || selectedStudent.id,
                                size: 18,
                                bold: true,
                                font: "Courier New",
                                color: "DC2626",
                              }),
                            ],
                          }),
                        ],
                        borders: {
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 1,
                            color: "E5E7EB",
                          },
                        },
                        margins: { bottom: 50 },
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "Admission: ",
                                size: 16,
                                color: "666666",
                                font: "Arial",
                              }),
                              new TextRun({
                                text: formatSimpleDate(selectedStudent.admission_date) || "27/08/2022",
                                size: 18,
                                bold: true,
                                font: "Arial",
                              }),
                            ],
                          }),
                        ],
                        borders: {
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 1,
                            color: "E5E7EB",
                          },
                        },
                        margins: { bottom: 50 },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "Graduation: ",
                                size: 16,
                                color: "666666",
                                font: "Arial",
                              }),
                              new TextRun({
                                text: selectedStudent.graduation_date ? formatSimpleDate(selectedStudent.graduation_date) : "21/12/2026",
                                size: 18,
                                bold: true,
                                font: "Arial",
                              }),
                            ],
                          }),
                        ],
                        borders: {
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 1,
                            color: "E5E7EB",
                          },
                        },
                        margins: { bottom: 50 },
                      }),
                    ],
                  }),
                ],
              }),

              // Spacing before table
              new Paragraph({
                text: "",
                spacing: { before: 300, after: 100 },
              }),

              // Performance table
              new Table({
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: "000000",
                  },
                  left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                  right: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: "000000",
                  },
                  insideHorizontal: {
                    style: BorderStyle.SINGLE,
                    size: 1,
                    color: "E5E7EB",
                  },
                  insideVertical: {
                    style: BorderStyle.SINGLE,
                    size: 1,
                    color: "000000",
                  },
                },
                rows: tableRows,
              }),

              // Performance metrics bar
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
                shading: { fill: "F9FAFB", type: ShadingType.SOLID },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: "000000",
                  },
                },
                children: [
                  new TextRun({
                    text: "PERFORMANCE METRICS:  ",
                    size: 16,
                    color: "666666",
                    font: "Arial",
                  }),
                  new TextRun({
                    text: "Current Avg: ",
                    size: 18,
                    bold: true,
                    font: "Arial",
                  }),
                  new TextRun({
                    text: `${stats.current}%`,
                    size: 18,
                    bold: true,
                    color: "4B0082",
                    font: "Arial",
                  }),
                  new TextRun({ text: "  |  ", size: 18, font: "Arial" }),
                  new TextRun({
                    text: "Cumulative Avg: ",
                    size: 18,
                    bold: true,
                    font: "Arial",
                  }),
                  new TextRun({
                    text: `${stats.cumulative}%`,
                    size: 18,
                    bold: true,
                    color: "4B0082",
                    font: "Arial",
                  }),
                ],
              }),

              // Academic recommendation
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({
                    text: "Recommendation:  ",
                    size: 16,
                    bold: true,
                    color: "999999",
                    font: "Arial",
                  }),
                ],
              }),
              new Paragraph({
                text: getAcademicRecommendation(),
                alignment: AlignmentType.LEFT,
                spacing: { after: 300 },
                border: {
                  left: {
                    style: BorderStyle.SINGLE,
                    size: 12,
                    color: "4B0082",
                  },
                },
                indent: { left: convertInchesToTwip(0.2) },
                run: {
                  size: 18,
                  bold: true,
                  font: "Arial",
                  color: "000000",
                },
              }),

              // Grading scale
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
                shading: { fill: "F9FAFB", type: ShadingType.SOLID },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 1,
                    color: "CCCCCC",
                  },
                },
                children: [
                  new TextRun({
                    text: "GRADING:  ",
                    size: 14,
                    bold: true,
                    color: "666666",
                    font: "Arial",
                    underline: {},
                  }),
                  new TextRun({
                    text: "A (70–100%)  |  B (60–69%)  |  C (50–59%)  |  D (40–49%)  |  ",
                    size: 14,
                    color: "666666",
                    font: "Arial",
                  }),
                  new TextRun({
                    text: "F (<40%)",
                    size: 14,
                    color: "DC2626",
                    font: "Arial",
                  }),
                ],
              }),

              // Microtext security line
              new Paragraph({
                text: "DO NOT REPRODUCE THIS DOCUMENT • BMI UNIVERSITY ACADEMIC RECORD SECURE VALIDATION LINE",
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                run: {
                  size: 12,
                  color: "999999",
                  font: "Arial",
                },
              }),

              // Signatures
              new Paragraph({
                text: "",
                spacing: { before: 400, after: 200 },
              }),

              // Signature table
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0 },
                  bottom: { style: BorderStyle.NONE, size: 0 },
                  left: { style: BorderStyle.NONE, size: 0 },
                  right: { style: BorderStyle.NONE, size: 0 },
                  insideHorizontal: { style: BorderStyle.NONE, size: 0 },
                  insideVertical: { style: BorderStyle.NONE, size: 0 },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({ text: "", spacing: { after: 400 } }),
                          new Paragraph({
                            text: "________________________",
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 50 },
                          }),
                          new Paragraph({
                            text: "Dr. Joseph Kiai",
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 50 },
                            run: {
                              size: 20,
                              italics: true,
                              font: "Georgia",
                            },
                          }),
                          new Paragraph({
                            text: "University Registrar",
                            alignment: AlignmentType.CENTER,
                            run: {
                              size: 14,
                              bold: true,
                              font: "Arial",
                              color: "666666",
                            },
                          }),
                        ],
                        width: { size: 40, type: WidthType.PERCENTAGE },
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: "" })],
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.NONE, size: 0 },
                          bottom: { style: BorderStyle.NONE, size: 0 },
                          left: { style: BorderStyle.NONE, size: 0 },
                          right: { style: BorderStyle.NONE, size: 0 },
                        },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({ text: "", spacing: { after: 400 } }),
                          new Paragraph({
                            text: "________________________",
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 50 },
                          }),
                          new Paragraph({
                            text: "Dr. Lilian Young",
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 50 },
                            run: {
                              size: 20,
                              italics: true,
                              font: "Georgia",
                            },
                          }),
                          new Paragraph({
                            text: "Dean, Faculty of Theology",
                            alignment: AlignmentType.CENTER,
                            run: {
                              size: 14,
                              bold: true,
                              font: "Arial",
                              color: "666666",
                            },
                          }),
                        ],
                        width: { size: 40, type: WidthType.PERCENTAGE },
                      }),
                    ],
                  }),
                ],
              }),

              // Footer
              new Paragraph({
                text: "",
                spacing: { before: 400 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0 },
                  bottom: { style: BorderStyle.NONE, size: 0 },
                  left: { style: BorderStyle.NONE, size: 0 },
                  right: { style: BorderStyle.NONE, size: 0 },
                  insideHorizontal: { style: BorderStyle.NONE, size: 0 },
                  insideVertical: { style: BorderStyle.NONE, size: 0 },
                },
                rows: [
                  new TableRow({
                    children: [
                      // LEFT — issuance metadata (30%)
                      new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "ISSUED: ",
                                size: 16,
                                bold: true,
                                color: "666666",
                                font: "Arial",
                                allCaps: true,
                              }),
                              new TextRun({
                                text: securityData?.issuedAt
                                  ? new Date(securityData.issuedAt)
                                      .toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })
                                      .toUpperCase()
                                  : new Date()
                                      .toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })
                                      .toUpperCase(),
                                size: 16,
                                font: "Arial",
                                color: "666666",
                              }),
                            ],
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "ID: ",
                                size: 16,
                                bold: true,
                                color: "666666",
                                font: "Arial",
                              }),
                              new TextRun({
                                text:
                                  securityData?.serialNumber ||
                                  `BMI-TR-${selectedStudent.id.toUpperCase()}`,
                                size: 16,
                                font: "Courier New",
                                color: "666666",
                              }),
                            ],
                          }),
                        ],
                      }),
                      // CENTRE — physical seal zone (40%)
                      new TableCell({
                        width: { size: 40, type: WidthType.PERCENTAGE },
                        borders: {
                          top: {
                            style: BorderStyle.DOTTED,
                            size: 6,
                            color: "CCCCCC",
                          },
                          bottom: {
                            style: BorderStyle.DOTTED,
                            size: 6,
                            color: "CCCCCC",
                          },
                          left: {
                            style: BorderStyle.DOTTED,
                            size: 6,
                            color: "CCCCCC",
                          },
                          right: {
                            style: BorderStyle.DOTTED,
                            size: 6,
                            color: "CCCCCC",
                          },
                        },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 800, after: 800 },
                            children: [
                              new TextRun({
                                text: "OFFICIAL SEAL (53MM)",
                                size: 16,
                                bold: true,
                                color: "CCCCCC",
                                font: "Arial",
                                allCaps: true,
                              }),
                            ],
                          }),
                        ],
                      }),
                      // RIGHT — digital validation badge (30%)
                      new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        shading: { fill: "FAF5FF" },
                        borders: {
                          top: {
                            style: BorderStyle.SINGLE,
                            size: 4,
                            color: "DDD6FE",
                          },
                          bottom: {
                            style: BorderStyle.SINGLE,
                            size: 4,
                            color: "DDD6FE",
                          },
                          left: {
                            style: BorderStyle.SINGLE,
                            size: 4,
                            color: "DDD6FE",
                          },
                          right: {
                            style: BorderStyle.SINGLE,
                            size: 4,
                            color: "DDD6FE",
                          },
                        },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: "✓ DIGITAL VALIDATION ACTIVE",
                                size: 16,
                                bold: true,
                                color: "4B0082",
                                font: "Arial",
                              }),
                            ],
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: "CERTIFIED TRUE COPY • E-TRANSCRIPT",
                                size: 13,
                                color: "9CA3AF",
                                font: "Arial",
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),

              new Paragraph({
                text: `Document ID: ${securityData?.serialNumber || `${selectedStudent.id}-${transcriptType.toUpperCase()}-${new Date().getFullYear()}`}`,
                alignment: AlignmentType.CENTER,
                spacing: { before: 200 },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: "C9A84C" },
                },
                run: {
                  size: 18,
                  font: "Arial",
                  color: "666666",
                },
              }),
              new Paragraph({
                text: "This is an official document issued by BMI University",
                alignment: AlignmentType.CENTER,
                run: {
                  size: 16,
                  italics: true,
                  font: "Arial",
                  color: "999999",
                },
              }),
            ],
          },
        ],
      });

      const blob = await (await import('../shims/docx')).Packer.toBlob(doc);
      saveAs(blob, `${fileName}.docx`);
    } catch (error: unknown) { // eslint-disable-next-line no-console
      console.error("Word generation failed:", error);
      alert("Word document generation failed. Please try again.");
    }
  
};

export const downloadSVG = async (context: ExportContext) => {
  const { selectedStudent, getAcademicRecommendation, fixedRows, stats, transcriptType, securityData, logo } = context;
  const formatNumber = (n: number, decimals: number = 2) => n.toFixed(decimals);
  const formatSimpleDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  

    if (!selectedStudent) return;

    try {
      const fileName =
        `${transcriptType}_TRANSCRIPT_${selectedStudent.id}_${selectedStudent.last_name}`.toUpperCase();

      // A4 dimensions at 96 DPI
      const width = 794;
      const height = 1123;

      // Wrap long text for recommendation
      const wrapText = (text: string, maxCharsPerLine: number): string[] => {
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        words.forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (testLine.length > maxCharsPerLine && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });

        if (currentLine) lines.push(currentLine);
        return lines;
      };

      const recommendationLines = wrapText(getAcademicRecommendation(), 95);

      // Build course table rows
      const rowHeightUnits = 23.4; // 6.2mm * (1123/297)
      const courseRows = fixedRows
        .map((rec, idx) => {
          const y = 430 + idx * rowHeightUnits;
          const gradeColor = rec
            ? rec.score >= 70
              ? "#10B981"
              : rec.score < 40
                ? "#DC2626"
                : "#4B0082"
            : "#4B0082";
          const rawName = rec?.courseName ?? "";
          const courseName =
            rawName.length > 45 ? rawName.substring(0, 42) + "..." : rawName;

          return `
    <!-- Row ${idx + 1} -->
    <rect x="50" y="${y - 15}" width="694" height="${rowHeightUnits}" fill="${idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB"}" />
    <text x="60" y="${y}" font-family="Courier New, monospace" font-size="9" font-weight="bold" fill="#4B0082">${rec?.courseCode ?? ""}</text>
    <text x="140" y="${y}" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#1F2937">${courseName.toUpperCase()}</text>
    <text x="520" y="${y}" font-family="Arial, sans-serif" font-size="9" fill="#374151" text-anchor="middle">${rec ? formatNumber(rec.credits, 2) : ""}</text>
    <text x="600" y="${y}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="${gradeColor}" text-anchor="middle">${rec ? `${rec.score}%` : ""}</text>
    <text x="670" y="${y}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="${gradeColor}" text-anchor="middle">${rec?.grade ?? ""}</text>
    <text x="720" y="${y}" font-family="Arial, sans-serif" font-size="8" fill="#6B7280" text-anchor="end">${rec?.term ?? ""}</text>`;
        })
        .join("");

      const tableEndY = 430 + fixedRows.length * rowHeightUnits;
      const statsY = tableEndY + 40;
      const recommendationY = statsY + 80;
      const signaturesY = height - 180;
      const footerY = height - 120;

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">

  <defs>
    <!-- Gold gradient for border -->
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD700" />
      <stop offset="50%" stop-color="#FFA500" />
      <stop offset="100%" stop-color="#FFD700" />
    </linearGradient>

    <!-- Security pattern -->
    <pattern id="securityPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M0,50 Q25,25 50,50 T100,50" fill="none" stroke="#E5E7EB" stroke-width="0.5" opacity="0.3" />
      <path d="M0,25 Q25,0 50,25 T100,25" fill="none" stroke="#E5E7EB" stroke-width="0.5" opacity="0.3" />
      <path d="M0,75 Q25,50 50,75 T100,75" fill="none" stroke="#E5E7EB" stroke-width="0.5" opacity="0.3" />
    </pattern>
  </defs>

  <!-- Background with security pattern -->
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <rect width="${width}" height="${height}" fill="url(#securityPattern)" opacity="0.4"/>

  <!-- Main border (double gold) -->
  <rect x="25" y="25" width="${width - 50}" height="${height - 50}"
        fill="none" stroke="url(#goldGradient)" stroke-width="3" rx="2"/>
  <rect x="30" y="30" width="${width - 60}" height="${height - 60}"
        fill="none" stroke="#C9A84C" stroke-width="1" rx="1"/>

  <!-- Top microtext security line -->
  <text x="${width / 2}" y="15" font-family="Arial, sans-serif" font-size="5" fill="#999999" text-anchor="middle" opacity="0.6">
    BMI UNIVERSITY OFFICIAL ACADEMIC TRANSCRIPT • SECURITY VALIDATED RECORD • DO NOT REPRODUCE • AUTHENTIC DOCUMENT • ID: ${securityData?.serialNumber || "PENDING"}
  </text>

  <!-- Logo -->
  <image x="${width / 2 - 35}" y="50" width="70" height="70" xlink:href="${logo}" preserveAspectRatio="xMidYMid meet"/>

  <!-- University Name -->
  <text x="${width / 2}" y="145" font-family="Georgia, serif" font-size="26" font-weight="bold"
        fill="#4B0082" text-anchor="middle" letter-spacing="1">BMI University</text>

  <!-- Subtitle -->
  <text x="${width / 2}" y="165" font-family="Georgia, serif" font-size="11" font-style="italic"
        fill="#6B7280" text-anchor="middle">Home of Knowledge and Innovation</text>

  <!-- Office of the Registrar -->
  <text x="${width / 2}" y="185" font-family="Arial, sans-serif" font-size="9" font-weight="bold"
        fill="#9CA3AF" text-anchor="middle" letter-spacing="2">OFFICE OF THE REGISTRAR</text>

  <!-- Document Title with borders -->
  <line x1="100" y1="205" x2="${width - 100}" y2="205" stroke="#000000" stroke-width="2"/>
  <text x="${width / 2}" y="225" font-family="Georgia, serif" font-size="18" font-weight="bold"
        fill="#000000" text-anchor="middle" letter-spacing="1">${transcriptType.toUpperCase()} ACADEMIC TRANSCRIPT</text>
  <line x1="100" y1="235" x2="${width - 100}" y2="235" stroke="#000000" stroke-width="2"/>

  <!-- Student Name (large and prominent) -->
  <text x="60" y="270" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#9CA3AF">Name:</text>
  <text x="60" y="290" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#000000" letter-spacing="0.5">
    ${selectedStudent.first_name.toUpperCase()} ${selectedStudent.last_name.toUpperCase()}
  </text>
  <line x1="60" y1="295" x2="400" y2="295" stroke="#CCCCCC" stroke-width="1"/>

  <!-- Student Details Grid (2 columns) -->
  <!-- Left Column -->
  <text x="60" y="320" font-family="Arial, sans-serif" font-size="9" fill="#6B7280">Year of study:</text>
  <text x="150" y="320" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000">${selectedStudent.year_of_study || "4 (FOUR)"}</text>
  <line x1="60" y1="325" x2="350" y2="325" stroke="#E5E7EB" stroke-width="0.5"/>

  <text x="60" y="345" font-family="Arial, sans-serif" font-size="9" fill="#6B7280">FACULTY OF:</text>
  <text x="150" y="345" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000">${(selectedStudent.faculty || "THEOLOGY").toUpperCase()}</text>
  <line x1="60" y1="350" x2="350" y2="350" stroke="#E5E7EB" stroke-width="0.5"/>

  <text x="60" y="370" font-family="Arial, sans-serif" font-size="9" fill="#6B7280">Admission:</text>
  <text x="150" y="370" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000">${formatSimpleDate(selectedStudent.admission_date) || selectedStudent.admission_date || ""}</text>
  <line x1="60" y1="375" x2="350" y2="375" stroke="#E5E7EB" stroke-width="0.5"/>

  <!-- Right Column -->
  <text x="400" y="320" font-family="Arial, sans-serif" font-size="9" fill="#6B7280">{t('academic.program')}:</text>
  <text x="470" y="320" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000">${(selectedStudent.program || selectedStudent.program_code || "").substring(0, 45).toUpperCase()}</text>
  <line x1="400" y1="325" x2="730" y2="325" stroke="#E5E7EB" stroke-width="0.5"/>

  <text x="400" y="345" font-family="Arial, sans-serif" font-size="9" fill="#6B7280">Student ID:</text>
  <text x="470" y="345" font-family="Courier New, monospace" font-size="10" font-weight="bold" fill="#DC2626">${selectedStudent.reg_no || selectedStudent.id}</text>
  <line x1="400" y1="350" x2="730" y2="350" stroke="#E5E7EB" stroke-width="0.5"/>

  <text x="400" y="370" font-family="Arial, sans-serif" font-size="9" fill="#6B7280">Graduation:</text>
  <text x="470" y="370" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000">${selectedStudent.graduation_date ? formatSimpleDate(selectedStudent.graduation_date) : "21/12/2026"}</text>
  <line x1="400" y1="375" x2="730" y2="375" stroke="#E5E7EB" stroke-width="0.5"/>

  <!-- Academic Performance Section -->
  <text x="60" y="405" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000">ACADEMIC PERFORMANCE</text>

  <!-- Table Header -->
  <rect x="50" y="410" width="694" height="25" fill="#F3F4F6"/>
  <line x1="50" y1="410" x2="744" y2="410" stroke="#000000" stroke-width="1"/>
  <line x1="50" y1="435" x2="744" y2="435" stroke="#000000" stroke-width="1"/>
  <line x1="50" y1="410" x2="50" y2="435" stroke="#000000" stroke-width="1"/>
  <line x1="744" y1="410" x2="744" y2="435" stroke="#000000" stroke-width="1"/>

  <text x="60" y="427" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#374151">Course Code</text>
  <text x="140" y="427" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#374151">Course Description</text>
  <text x="520" y="427" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#374151" text-anchor="middle">Hours</text>
  <text x="600" y="427" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#374151" text-anchor="middle">Score</text>
  <text x="670" y="427" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#374151" text-anchor="middle">Grade</text>
  <text x="720" y="427" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#374151" text-anchor="end">Term</text>

  <!-- Table Border Lines -->
  <line x1="50" y1="410" x2="50" y2="${tableEndY}" stroke="#000000" stroke-width="1"/>
  <line x1="744" y1="410" x2="744" y2="${tableEndY}" stroke="#000000" stroke-width="1"/>
  <line x1="50" y1="${tableEndY}" x2="744" y2="${tableEndY}" stroke="#000000" stroke-width="1"/>

  <!-- Course Rows -->
  ${courseRows}

  <!-- Performance Metrics Bar -->
  <rect x="50" y="${statsY - 20}" width="694" height="50" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="1"/>
  <text x="${width / 2}" y="${statsY}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#374151" text-anchor="middle">
    Current Term Average: <tspan fill="#4B0082">${stats.current}%</tspan>  |  Cumulative Average: <tspan fill="#4B0082">${stats.cumulative}%</tspan>
  </text>

  <!-- Grading Scale -->
  <text x="${width / 2}" y="${statsY + 18}" font-family="Arial, sans-serif" font-size="8" fill="#6B7280" text-anchor="middle">
    A (70–100%) | B (60–69%) | C (50–59%) | D (40–49%) | F (&lt;40%)
  </text>

  <!-- Academic Recommendation -->
  <rect x="50" y="${recommendationY - 10}" width="5" height="80" fill="#4B0082"/>
  <text x="65" y="${recommendationY + 5}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000">ACADEMIC RECOMMENDATION</text>
  ${recommendationLines
    .map(
      (line, idx) => `
  <text x="65" y="${recommendationY + 25 + idx * 14}" font-family="Arial, sans-serif" font-size="9" fill="#374151">${line}</text>`,
    )
    .join("")}

  <!-- Signatures Section -->
  <text x="200" y="${signaturesY}" font-family="Arial, sans-serif" font-size="10" fill="#000000">_________________________</text>
  <text x="550" y="${signaturesY}" font-family="Arial, sans-serif" font-size="10" fill="#000000">_________________________</text>

  <text x="200" y="${signaturesY + 20}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000" text-anchor="middle">Dr. Joseph Kiai</text>
  <text x="550" y="${signaturesY + 20}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#000000" text-anchor="middle">Dr. Lilian Young</text>

  <text x="200" y="${signaturesY + 35}" font-family="Arial, sans-serif" font-size="8" font-style="italic" fill="#6B7280" text-anchor="middle">University Registrar</text>
  <text x="550" y="${signaturesY + 35}" font-family="Arial, sans-serif" font-size="8" font-style="italic" fill="#6B7280" text-anchor="middle">Dean, Faculty of Theology</text>

  <!-- Footer rule -->
  <line x1="60" y1="${footerY}" x2="${width - 60}" y2="${footerY}" stroke="#C9A84C" stroke-width="1"/>

  <!-- LEFT: issuance metadata -->
  <text x="60" y="${footerY + 18}" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#6B7280" text-transform="uppercase">ISSUED: ${securityData?.issuedAt ? new Date(securityData.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }).toUpperCase() : new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }).toUpperCase()}</text>
  <text x="60" y="${footerY + 32}" font-family="Courier New, monospace" font-size="8" fill="#6B7280">ID: ${securityData?.serialNumber || `BMI-TR-${selectedStudent.id.toUpperCase()}`}</text>

  <!-- CENTRE: physical seal zone (dashed circle + label) -->
  <circle cx="${width / 2}" cy="${footerY}" r="100" fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-dasharray="5,4"/>
  <text x="${width / 2}" y="${footerY - 10}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#D1D5DB" text-anchor="middle" letter-spacing="3">OFFICIAL</text>
  <text x="${width / 2}" y="${footerY + 10}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#D1D5DB" text-anchor="middle" letter-spacing="3">SEAL</text>
  <text x="${width / 2}" y="${footerY + 25}" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#D1D5DB" text-anchor="middle" opacity="0.5">53MM DIAMETER</text>

  <!-- RIGHT: digital validation badge -->
  <rect x="${width - 240}" y="${footerY + 8}" width="180" height="40" rx="0" fill="#FAF5FF" stroke="#DDD6FE" stroke-width="1"/>
  <text x="${width - 150}" y="${footerY + 23}" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#4B0082" text-anchor="middle" letter-spacing="1">✓ DIGITAL VALIDATION ACTIVE</text>
  <text x="${width - 150}" y="${footerY + 36}" font-family="Arial, sans-serif" font-size="6.5" fill="#9CA3AF" text-anchor="middle" letter-spacing="1">CERTIFIED TRUE COPY • E-TRANSCRIPT</text>

  <!-- Bottom microtext -->
  <text x="${width / 2}" y="${footerY + 80}" font-family="Arial, sans-serif" font-size="7" font-style="italic" fill="#9CA3AF" text-anchor="middle">This is an official document issued by BMI University</text>

  <!-- Bottom microtext security line -->
  <text x="${width / 2}" y="${height - 10}" font-family="Arial, sans-serif" font-size="5" fill="#999999" text-anchor="middle" opacity="0.6">
    OFFICIAL TRANSCRIPT • TAMPER-EVIDENT SECURITY FEATURES • VERIFY AT ${securityData?.verificationUrl || "BMI.EDU/VERIFY"}
  </text>
</svg>`;

      // Download SVG
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: unknown) { // eslint-disable-next-line no-console
      console.error("SVG generation failed:", error);
      alert("SVG generation failed. Please try again.");
    }
  
};
