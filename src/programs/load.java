List<Note> load(Path file) {
  List<String> lines = read(file);             // entry
  List<Note> notes = new ArrayList<>();
  for (int i = 0; i < lines.size(); i++) {     // header: i < lines.size()
    String line = lines.get(i);                // body
    if (!line.isBlank()) {
      notes.add(parse(line));                  // then
    }
  }                                            // next: i++
  return notes;                                // exit
}
