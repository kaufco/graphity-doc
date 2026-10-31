List<Note> Load(string file)
{
    string[] lines = Read(file);                // entry
    var notes = new List<Note>();
    Note? last = null;
    for (int i = 0; i < lines.Length; i++)      // header: i < lines.Length
    {
        string line = lines[i];                 // body
        if (!string.IsNullOrWhiteSpace(line))
        {
            last = Parse(line);                 // then
            notes.Add(last);
        }
    }                                           // next: i++
    _lastLoaded = last;                         // exit
    return notes;
}
