meta:
  id: local_government_code
  title: Japan local government code binary (JLPR / JLDT / JLIX)
  xref:
    issue: 73
  license: MIT
  endian: le

doc: |
  Custom little-endian binary for @b4moss/jp-local-gov-id-data.
  Magics JLPR / JLDT / JLIX share a common header then fixed-size records and a
  NUL-terminated UTF-8 string table.
  String offsets are relative to the start of the string table.
  Identical strings must share one offset (encoder requirement).
  JLIX (#63) is a flat 2-gram search posting index.

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
        '"JLIX"': ngram_posting_record
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

  ngram_posting_record:
    doc: |
      Fixed 13-byte 2-gram posting (u4+u1+u1+u4+u1+u1+u1).
      pref_code and muni_code are distinct (e.g. Osaka: pref=27, muni=270008).
    seq:
      - id: gram_offset
        type: u4
      - id: gram_type
        type: u1
        enum: gram_type_enum
      - id: kind
        type: u1
        enum: kind_enum
      - id: muni_code
        type: u4
      - id: pref_code
        type: u1
      - id: has_ward
        type: u1
      - id: is_ward
        type: u1

enums:
  gram_type_enum:
    0: name
    1: kana
  kind_enum:
    0: pref
    1: muni
