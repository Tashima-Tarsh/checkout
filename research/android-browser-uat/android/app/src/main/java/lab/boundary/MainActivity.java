package lab.boundary;
import android.Manifest;
import android.app.*;
import android.os.*;
import android.content.pm.PackageManager;
import android.widget.*;
import java.security.SecureRandom;
public class MainActivity extends Activity {
 @Override public void onCreate(Bundle b) {
  super.onCreate(b);
  NotificationManager manager=getSystemService(NotificationManager.class);
  manager.createNotificationChannel(new NotificationChannel("synthetic","Synthetic test only",NotificationManager.IMPORTANCE_DEFAULT));
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(1);layout.setPadding(32,48,32,32);
  TextView label=new TextView(this);label.setText("Synthetic only. No real payments or notification reading.");layout.addView(label);
  Button post=new Button(this);post.setText("Generate synthetic notification");layout.addView(post);
  post.setOnClickListener(v->{
   if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);return;}
   byte[] bytes=new byte[16];new SecureRandom().nextBytes(bytes);StringBuilder token=new StringBuilder("LAB-");for(byte x:bytes)token.append(String.format("%02x",x&255));
   manager.notify(1,new Notification.Builder(this,"synthetic").setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("SYNTHETIC ONLY — INR 49.00").setContentText(token.toString()).setStyle(new Notification.BigTextStyle().bigText(token.toString())).build());
   label.setText("Record canary separately after exporting browser observation.");
  });setContentView(layout);
 }
}
