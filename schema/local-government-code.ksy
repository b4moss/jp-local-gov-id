meta:
  id: local_government_code
  title: Japan local government code binary (JLPR / JLDT)
  xref:
    issue: 73
  license: MIT
  endian: le

doc: |
  Custom little-endian binary for @b4moss/jp-local-gov-id-data.
  Two magics share a common header then fixed-size records and a NUL-terminated UTF-8 string table.
  String offsets are relative to the start of the string table.
  Identical strings must share one offset (encoder requirement).

seq:
  - id: magic
    size: 4
    type: str
    encoding: ASCII
  - id: version
    type: u1
  - id: as_of_len
    type: u1
  - id: as_of
    size: as_of_len
    type: str
    encoding: UTF-8
  - id: record_count
    type: u2
  - id: records
    type:
      switch-on: magic
      cases:
        '"JLPR"': prefecture_record
        '"JLDT"': municipality_record
    repeat: expr
    repeat-expr: record_count
  - id: string_table
    size-eos: true

types:
  prefecture_record:
    doc: Fixed 16-byte prefecture record (u1+u4+u4+u4+u1+u1+u1).
    seq:
      - id: pref_code
        type: u1
      - id: name_offset
        type: u4
      - id: name_kana_offset
        type: u4
      - id: muni_code
        type: u4
      - id: muni_count_both
        type: u1
      - id: muni_count_city
        type: u1
      - id: muni_count_ward
        type: u1

  municipality_record:
    doc: Fixed 14-byte municipality record (u4+u4+u4+u1+u1).
    seq:
      - id: code
        type: u4
      - id: name_offset
        type: u4
      - id: name_kana_offset
        type: u4
      - id: has_ward
        type: u1
      - id: is_ward
        type: u1
