List<Note> load(Path file) {
  List<String> lines = read(file);             // entry
  List<Note> notes = new ArrayList<>();
  Note last = null;
  for (int i = 0; i < lines.size(); i++) {     // header: i < lines.size()
    String line = lines.get(i);                // body
    if (!line.isBlank()) {
      last = parse(line);                      // then
      notes.add(last);
    }
  }                                            // next: i++
  lastLoaded = last;                           // exit
  return notes;
}
